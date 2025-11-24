const orderCount = 10;
const orders = [];

const grid = document.getElementById("orderGrid");

// Create slots
for (let i = 0; i < orderCount; i++) {
    const box = document.createElement("div");
    box.className = "order-box";
    box.innerHTML = `
        <div class="order-header">Order Slot #${i + 1}</div>
        <div class="messages"></div>
      `;
    grid.appendChild(box);
    orders.push({
        index: i,
        box,
        msgBox: box.querySelector(".messages"),
    });
}

function appendLog(msgBox, text, type = "") {
    const div = document.createElement("div");
    div.className = "log-line " + type;
    div.innerText = text;
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
}

async function fireOrder(slot) {
    const msgBox = slot.msgBox;
    msgBox.innerHTML = "";

    appendLog(msgBox, "Creating order...", "status");

    try {
        const res = await fetch("http://localhost:3000/api/orders/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                inputMint: "SOL",
                outputMint: "USDC",
                amount: 1.5,
                slippage_pct: 0.1
            })
        });

        const { orderId } = await res.json();

        slot.box.querySelector(".order-header").innerText = `Order #${orderId}`;
        appendLog(msgBox, "Order created. Connecting WS...", "status");

        const ws = new WebSocket(`ws://localhost:3000/api/orders/ws?orderId=${orderId}`);

        ws.onopen = () => {
            appendLog(msgBox, "[WS OPEN]", "status");
        };

        ws.onmessage = (e) => {
            const message = e.data;

            try {
                const obj = JSON.parse(message);

                // snapshot → blue
                if (obj.type === "snapshot") {
                    appendLog(msgBox, message, "snapshot");
                    return;
                }

                // status → inspect status field
                if (obj.status === "failed") {
                    appendLog(msgBox, message, "failed");
                    return;
                }

                if (obj.status === "confirmed") {
                    appendLog(msgBox, message, "confirmed");
                    return;
                }

                // all other statuses → normal green
                appendLog(msgBox, message, "status");
            } catch {
                appendLog(msgBox, message, "status");
            }
        };

        ws.onerror = () => {
            appendLog(msgBox, "[WS ERROR]", "error");
        };

        ws.onclose = () => {
            appendLog(msgBox, "[WS CLOSED]", "close");
        };

    } catch (err) {
        appendLog(msgBox, "ERROR: " + err.message, "error");
    }
}

document.getElementById("orderAllBtn").addEventListener("click", async () => {
    const tasks = orders.map(slot => fireOrder(slot));
    await Promise.all(tasks);
});
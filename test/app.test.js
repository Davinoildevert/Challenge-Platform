const test = require("node:test");
const assert = require("node:assert/strict");
const { app, calculateTotal } = require("../src/app");

test("calculates the total for several items", () => {
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 }
  ];

  assert.equal(calculateTotal(items), 35);
});

test("returns zero for an empty basket", () => {
  assert.equal(calculateTotal([]), 0);
});

test("does not mutate the input items", () => {
  const items = [{ price: 4, quantity: 2 }];
  const copy = JSON.parse(JSON.stringify(items));

  calculateTotal(items);

  assert.deepEqual(items, copy);
});

async function withServer(callback) {
  const server = app.listen(0);

  await new Promise((resolve) => {
    server.once("listening", resolve);
  });

  const { port } = server.address();

  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

test("POST /tasks creates a new task", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Create Dockerfile"
      })
    });

    assert.equal(response.status, 201);

    const task = await response.json();

    assert.equal(task.title, "Create Dockerfile");
    assert.equal(task.completed, false);
    assert.ok(task.id);
  });
});

test("POST /tasks generates unique IDs", async () => {
  await withServer(async (baseUrl) => {
    const firstResponse = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Task one"
      })
    });

    const secondResponse = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Task two"
      })
    });

    const firstTask = await firstResponse.json();
    const secondTask = await secondResponse.json();

    assert.notEqual(firstTask.id, secondTask.id);
  });
});

test("POST /tasks returns 400 when title is empty", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: ""
      })
    });

    assert.equal(response.status, 400);

    const body = await response.json();
    assert.equal(body.error, "Title is required");
  });
});



async function createTask(baseUrl, title) {
  const response = await fetch(`${baseUrl}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title })
  });

  return response.json();
}

test("PATCH /tasks/:id marks an existing task as completed", async () => {
  await withServer(async (baseUrl) => {
    const created = await createTask(baseUrl, "Write README");

    const response = await fetch(`${baseUrl}/tasks/${created.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ completed: true })
    });

    assert.equal(response.status, 200);

    const task = await response.json();

    assert.equal(task.id, created.id);
    assert.equal(task.title, "Write README");
    assert.equal(task.completed, true);
  });
});

test("PATCH /tasks/:id returns 404 for an unknown task", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/tasks/999999`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ completed: true })
    });

    assert.equal(response.status, 404);

    const body = await response.json();
    assert.equal(body.error, "Task not found");
  });
});

test("PATCH /tasks/:id returns 400 when completed is not a boolean", async () => {
  await withServer(async (baseUrl) => {
    const created = await createTask(baseUrl, "Invalid update");

    const response = await fetch(`${baseUrl}/tasks/${created.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ completed: "yes" })
    });

    assert.equal(response.status, 400);

    const body = await response.json();
    assert.equal(body.error, "completed must be a boolean");
  });
});

test("DELETE /tasks/:id deletes an existing task", async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Task to delete"
      })
    });

    const task = await createResponse.json();

    const deleteResponse = await fetch(`${baseUrl}/tasks/${task.id}`, {
      method: "DELETE"
    });

    assert.equal(deleteResponse.status, 204);
  });
});

test("DELETE /tasks/:id returns 404 for unknown task", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/tasks/999999`, {
      method: "DELETE"
    });

    assert.equal(response.status, 404);

    const body = await response.json();
    assert.equal(body.error, "Task not found");
  });
});
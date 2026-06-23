const express = require('express');
const app = express();

const asyncMiddleware = async (req, res, next) => {
  try {
    await Promise.resolve(); // Simulate async work
    next(); // Calls downstream handler
  } catch (err) {
    console.log('Caught in middleware:', err.message);
    res.status(401).send('Caught in middleware');
  }
};

app.get('/test', asyncMiddleware, (req, res) => {
  throw new Error('Business logic error');
});

const server = app.listen(3000, async () => {
  try {
    const fetch = require('node-fetch');
    const res = await fetch('http://localhost:3000/test');
    console.log(await res.text());
  } catch (err) {
    console.error(err);
  }
  server.close();
});

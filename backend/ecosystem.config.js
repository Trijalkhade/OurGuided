module.exports = {
  apps: [{
    name: 'ourguided-api',
    script: 'server.js',
    instances: 'max',      // Use all available CPUs
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    env: { NODE_ENV: 'production' }
  }]
};

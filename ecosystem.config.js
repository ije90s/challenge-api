module.exports = {
  apps: [
    {
      name: 'challenge-api',
      script: 'dist/main.js',

      instances: 1,          // cluster 모드
      exec_mode: 'cluster',

      wait_ready: true,
      listen_timeout: 5000,
      kill_timeout: 5000,

      env_production: {
        NODE_ENV: 'prod',
      },
    },
  ],
};

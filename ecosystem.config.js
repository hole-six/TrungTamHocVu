module.exports = {
  apps: [
    {
      name: "mshangedu",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 5050 -H 127.0.0.1",
      cwd: "/var/www/mshangedu",
      interpreter: "/root/.nvm/versions/node/v20.20.2/bin/node",
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

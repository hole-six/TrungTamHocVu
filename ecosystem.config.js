module.exports = {
  apps: [
    {
      name: "hole-six",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/var/www/hole-six",
      interpreter: "/root/.nvm/versions/node/v20.20.0/bin/node",
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "5003",
        HOSTNAME: "127.0.0.1",
      },
    },
  ],
};

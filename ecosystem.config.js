module.exports = {
  apps: [
    {
      name: 'exposure-backend',
      script: './dist/main.js',
      instances: 1, // or use 'max' for the maximum number of CPus
      exec_mode: 'cluster', // change to "fork" if you prefer a single instance
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      max_size: '10M',
      max_restarts: 10,
      error_file: './logs/error.log', // Optional: log file for errors
      out_file: './logs/output.log', // Optional: log file for standard output
    },
  ],
};

module.exports = {
  client: 'pg',
  connection: process.env.DATABASE_URL || 'postgres://tibo:tibo_dev_password@localhost:5434/tibo',
  migrations: { directory: './migrations' },
};

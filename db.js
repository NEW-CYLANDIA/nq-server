require('dotenv').config()

const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    port: process.env.PGPORT, // default Postgres port
    database: process.env.PGDATABASE,
    ssl: true
});

module.exports = {
    query: (text, params) => pool.query(text, params)
};
const { Pool } = require('pg');

const pool = new Pool({

connectionString:
process.env.DATABASE_URL,

ssl:{
rejectUnauthorized:false
},

// increased timeout
connectionTimeoutMillis:30000,

// reduce idle holding
idleTimeoutMillis:10000,

// limit connections
max:5

});

pool.on(
'connect',
()=>{

console.log(
'✅ Database Connected'
);

}
);

pool.on(
'error',
(err)=>{

console.log(
'Database Error:',
err.message
);

}
);

module.exports = {
query:(text,params)=>
pool.query(text,params)
};
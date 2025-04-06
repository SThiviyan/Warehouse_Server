const { default: fastifyJwt } = require('fastify-jwt');
const fs = require('node:fs')
const path = require('node:path')
const fastify = require('fastify')({ 
    logger: true ,
    http2: true,

    // IN PRODUCTION PUT IN THE SERVERS SIGNED KEY AND CERT (LETSENCRYPT)
    https: {
        key: fs.readFileSync(path.join(__dirname, 'keys', 'myCA.key')),
        cert: fs.readFileSync(path.join(__dirname, 'keys', 'myCA.pem')),
    }
});
const fastifyPostgres = require('@fastify/postgres');
const bcyrpt = require('bcrypt')
const fastifyEnv = require('@fastify/env')
require('dotenv').config()


//GET Request for retrieving record
//POST request creates a new record
//PUT requests updates a record
//DELETE request deletes one


/*

REST API for the Warehouse App
-> with JWS authentication
-> returns JSON Format
-> connected to a PostqreSQL Database

*/




//Postgre Database

const connectionString = 'postgres://' + process.env.DATABASE_USER + ':' + process.env.DATABASE_PASSWORD + '@' + process.env.DATABASE_DOMAIN + ':' + process.env.DATABASE_PORT + '/' + process.env.DATABASE_NAME;
fastify.register(fastifyPostgres , {
    connectionString: connectionString
});


 //JWT 
 fastify.register(require('fastify-jwt'), {
    secret: process.env.JWT_SECRET
});




fastify.decorate("authenticate", async function(request, reply){
    try
    {
        await request.jwtVerify()
    }
    catch(err)
    {
        reply.code(401).send({error: 'Unauthorized'});
    }
});




//Custom server header
fastify.addHook("onSend", (request, reply, payload, done) => {
    reply.header("Server", "Warehouse");
    done();
});


//POST Requests
fastify.post('/signup', async (req, reply) => {
    const {email, password} = req.body

    const hashedPassword = await bcrypt.hash(password, 10);

    try {

        const results = await fastify.pg.query(
            'SELECT email FROM users WHERE email=$1;',
            [email]
        );

        if(results.rowCount == 0)
        {
       
            await fastify.pg.query(
                'INSERT INTO users (email, password) VALUES ($1, $2)',
                [email, hashedPassword]
            );
            

            const token = fastify.jwt.sign({username: email}, {expiresIn: '1h'});
            reply.send({token});
        }
        else
        {
            throw new Error('user already registered');
        }
    }
    catch(err)
    {
        reply.code(500).send({error: 'User registration failed', details: err.message});   
    }
});

fastify.post('/login', async (req, reply) => {
    const {username, password} = req.body;

    try
    {
        const {rows} = await fastify.pg.query(
            'SELECT * FROM users WHERE email = $1',
            [username]
        );

        if(rows.length === 0)
        {
            return reply.code(401).send({error: 'Invalid credentials'});
        }

        const user = rows[0]

        //const isValid = await bcrypt.compare(password, user.password);
        var isValid = false
        if(password == user.password)
            isValid = true

        if(!isValid)
        {
            return reply.code(401).send({error: 'Invalid credentials'});
        }

        const token = fastify.jwt.sign({username: user.email}, {expiresIn: '1h'});
        reply.send({ token });
    }
    catch(err)
    {
        reply.code(500).send({error: 'Login failed', details: err.message});
    }
});

/*
fastify.post('/api/product/:newproduct',
    { schema: productSchema},
);
*/    





//GET Requests


fastify.get('/', function handler(request, reply){
    reply.send("WarehouseApp REST API. Authenticate using /login or /signup");
});

fastify.get('/api/userdata', {preHandler: [fastify.authenticate]}, async(request, reply)=>{
    try 
    {
        const token = request.headers.authorization.split(' ')[1];
        const decoded = fastify.jwt.decode(token);
        

        const result = await fastify.pg.query('SELECT * FROM users WHERE email = $1;', [decoded.username]);
        reply.send(result.rows);
    }
    catch(err)
    {
        serverError();
    }

});


fastify.get('/api/currencies', {preHandler: [fastify.authenticate]}, async(request, reply) => {
    
    try{
        const result = await fastify.pg.query('SELECT * FROM currencies;',)

        reply.send(result.rows);
    }
    catch(err)
    {
        serverError()
    }
});


fastify.get('/api/units', {preHandler: [fastify.authenticate]},async(request, reply)=>{       
    try{
        const result = await fastify.pg.query('SELECT * FROM units;',)
        reply.send(result.rows);
    }
    catch(err)
    {
        serverError();
    } 
    
});

fastify.get('/api/products', {preHandler: [fastify.authenticate]}, async(request, reply) => {
    try{
        const result = await fastify.pg.query('SELECT * FROM user_products WHERE owner_id == ;')
    }
    catch(err)
    {

    }
});



//Server Listen

fastify.listen({port: 3000}, (err) => {
    if(err)
    {
        fastify.log.error(err)
        process.exit(1)
    }

    console.log("Server listening on Port 3000")
    console.log(process.env)
    //serverError();
});


function serverError()
{
    reply.status(500).send({error: 'Internal Server error'});
}

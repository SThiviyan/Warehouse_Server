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
fastify.post('/api/signup', async (req, reply) => {
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

            const {rows} = await fastify.pg.query(
                'SELECT * FROM users WHERE email=$1',
                [email]
            );


            const user = rows[0]
            reply.send({token, user});
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

fastify.post('/api/login', async (req, reply) => {
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
        
        reply.send({token, user});

    }
    catch(err)
    {
        reply.code(500).send({error: 'Login failed', details: err.message});
    }
});


fastify.post('/api/changePassword', {preHandler: [fastify.authenticate]},async (req, reply) => {
    const {oldPassword, newPassword} = req.body

    try{
        const token = request.headers.split(' ')[1];
        const decoded = fastify.jwt.decode(token)
        const email = decoded.username

        const {rows} = await fastify.pg.query(
            'SELECT password FROM users WHERE users.email = $1;',
            [email]
        )


        //IMPORTANT: check server response codes and replace with fitting ones

        if(rows.length === 0)
        {
            return reply.code(401).send({error: 'Invalid credentials'});
        }
        

        const result = rows[0]

        if(result != oldPassword)
        {
            return reply.code(401).send({error: 'Invalid credentials'});
        }


        await fastify.pg.query(
            'UPDATE users SET users.password=$1 WHERE users.email=$2;',
            [newPassword, email]
        )

        //THINK ABOUT WHAT TO SEND BACK
        reply.send({response: 'done.'});

    }
    catch(err)
    {

    }
})


fastify.post('/api/product', {preHandler: [fastify.authenticate]}, async(request, reply)=>{
    const {productname, barcode, description, price, size, unit, currency, } = req.body

});
    





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

fastify.get('/api/categories', {preHandler: [fastify.authenticate]}, async(request, reply) => {
    
    try{
        const token = request.headers.authorization.split(' ')[1];
        const decoded = fastify.jwt.decode(token);
        const email = decoded.username;

        const result = await fastify.pg.query(
            'SELECT categories.name FROM categories INNER JOIN users ON users.id = categories.user_id WHERE users.email=$1;',
            [email]
        );

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

        const token = request.headers.authorization.split(' ')[1];
        const decoded = fastify.jwt.decode(token);

        const email = decoded.username

        //JOIN Statement required
        const result = await fastify.pg.query(
            'SELECT * FROM user_products INNER JOIN products ON products.id=user_products.id INNER JOIN users ON users.id=user_products.owner_id WHERE users.email = $1;',
            [email]
        )

        reply.send({result});
    }
    catch(err)
    {

    }
});


//needs to be more efficient (streaming, zipping, etc.)
fastify.get('/api/product', {preHandler: [fastify.authenticate]}, async(request, reply) => {

    const {productid} = req.body 

    try{


        const token = request.headers.authorization.split(' ')[1];
        const decoded = fastify.jwt.decode(token);

        const email = decoded.username
        const  product = productid 

        //JOIN statement required 
        const queryresult = await fastify.pg.query(
            'SELECT * FROM user_products INNER JOIN products ON products.id=user_products.id INNER JOIN users ON users.id=user_products.owner_id  WHERE users.email == $1 AND  user_products.id== $2;',
            [email, product]
        )

        const result = queryresult[0]

        reply.send({result})
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
});


function serverError()
{
    reply.status(500).send({error: 'Internal Server error'});
}

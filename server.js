const { default: fastifyJwt } = require('fastify-jwt');
const fastify = require('fastify')({ logger: true });
const fastifyPostgres = require('@fastify/postgres');
const bcyrpt = require('bcrypt')


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
fastify.register(fastifyPostgres , {
    connectionString: 'postgres://postgres:JillCeq31082024@localhost:5432/warehouseapp'
});

//JWT 
fastify.register(require('fastify-jwt'), {
    secret: 'secret'
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
    const {username, password} = req.body

    const hashedPassword = await bcrypt.hash(password, 10);

    try {


        await fastify.pg.query(
            'INSERT INTO users (email, password) VALUES ($1, $2)',
            [username, hashedPassword]
        );

        const token = fastify.jwt.sign({username});
        reply.send({token});

        reply.err
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

        const isValid = await bcrypt.compare(password, user.password);

        if(!isValid)
        {
            return reply.code(401).send({error: 'Invalid credentials'});
        }

        const token = fastify.jwt.sign({username: user.email});
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
    reply.send({hello: 'world'})
});

fastify.get('/api/userdata', {preHandler: [fastify.authenticate]}, async(request, reply)=>{
    try 
    {
        const result = await fastify.pg.query('SELECT * FROM users WHERE id = 1;')
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
        const result = await fastify.pg.query('SELECT * FROM units;', )
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
});



//Server Listen

fastify.listen({port: 3000}, (err) => {
    if(err)
    {
        fastify.log.error(err)
        process.exit(1)
    }

    console.log("Server listening on Port 3000")
    //serverError();
});


function serverError()
{
    reply.status(500).send({error: 'Internal Server error'});
}

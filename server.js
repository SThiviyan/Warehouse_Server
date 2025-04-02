const { default: fastifyJwt } = require('fastify-jwt');

const fastify = require('fastify')();

//import { Database } from './database.cjs';


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
fastify.register(require('@fastify/postgres'),
{
    connectionString: 'postgres://postgres:JillCeq31082024@localhost:5432/warehouseapp'
});

fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "",
});




//POST Requests

fastify.post('/api/product/:newproduct',
    { schema: productSchema},
    
)






//GET Requests


fastify.get('/', function handler(request, reply){
    reply.send({hello: 'world'})
});



fastify.get('/api/auth', function handler(request, reply)
{
    reply.send("test")

    
    
    /*
    fastify.pg.query(
        '', [request.params.id],
        function onResult(err, result)
        {
            reply.send(err || result)
        }
    )
    */
});




fastify.get('/api/users/:id', async(request, reply)=>{
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




fastify.get('/api/units',async(request, reply)=>{
    try{
        const result = await fastify.pg.query('SELECT * FROM units;', )
        reply.send(result.rows);    
    }
    catch(err)
    {
        serverError();
    } 
});





fastify.listen({port: 3000}, (err) => {
    if(err)
    {
        fastify.log.error(err)
        process.exit(1)
    }

    serverError();
});


function serverError()
{
    reply.status(500).send({error: 'Internal Server error'});
}

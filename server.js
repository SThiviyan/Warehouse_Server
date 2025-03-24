const Fastify = require('fastify');
const fastify = Fastify()

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


fastify.get('/', function handler(request, reply){
    reply.send({hello: 'world'})
});


fastify.get('/api/user', async(request, reply) => 
{
    return {}
});

fastify.get('/users/:id', async(request, reply)=>{
    const newUser = {}
});


fastify.listen({port: 3000}, (err) => {
    if(err)
    {
        fastify.log.error(err)
        process.exit(1)
    }
});
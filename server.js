const Fastify = require('fastify');
const fastify = Fastify()

fastify.get('/', function handler(request, reply){
    reply.send({hello: 'world'})
})



fastify.listen({port: 3000}, (err) => {
    if(err)
    {
        fastify.log.error(err)
        process.exit(1)
    }
})
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
const helmet = require('@fastify/helmet');
const bcyrpt = require('bcrypt');
const { type } = require('node:os');
const { isatty } = require('node:tty');
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

//helmet
fastify.register(helmet, {
  global: true,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: [`'self'`]
    }
  },
  hsts: { maxAge: 31536000 }
})




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

fastify.decorate("", async function(request, reply){
    //logs what the user requested on what device, for device synchronization 
});




//Custom server header
fastify.addHook("onSend", (request, reply, payload, done) => {
    reply.header("Server", "Warehouse");
    done();
});




//
//  POST Requests
//

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
            

            const token = fastify.jwt.sign({username: email}, {expiresIn: '7d'});

            const {rows} = await fastify.pg.query(
                'SELECT * FROM users WHERE email=$1',
                [email]
            );


            const user = rows[0]
            reply.send({token, user});
        }
        else
        {
            reply.code(400).send({error: 'User already registered'});
        }
    }
    catch(err)
    {
        reply.code(500).send({error: 'User registration failed'});   
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
            return reply.code(400).send({error: 'User does not exist'});
        }

        const user = rows[0]

        //const isValid = await bcrypt.compare(password, user.password);
        var isValid = false
        if(password == user.password)
        {
            isValid = true
        }

        if(!isValid)
        {
            return reply.code(400).send({error: 'Invalid credentials'});
        }

        const token = fastify.jwt.sign({username: user.email}, {expiresIn: '1h'});
        
        reply.send({token, user});

    }
    catch(err)
    {
        reply.code(500).send({error: 'login failed'});
    }
});


fastify.post('/api/changePassword', {preHandler: [fastify.authenticate]},async (req, reply) => {
    const {oldPassword, newPassword} = req.body

    try{

        //if(typeof(oldPassword) == BigInt && typeof(newPassword) == BigInt)

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

        //hashed passwort or something here!

        if(result != oldPassword)
        {
            return reply.code(401).send({error: 'Invalid credentials'});
        }


        await fastify.pg.query(
            'UPDATE users SET users.password=$1 WHERE users.email=$2;',
            [newPassword, email]
        )

        //THINK ABOUT WHAT TO SEND BACK
        reply.status(200).send({token});

    }
    catch(err)
    {
        reply.status(500).send({error: 'passwordchange failed'});
    }
})


fastify.post('api/user', {preHandler: [fastify.authenticate]}, async(request, reply)=>{
    const {id, email, password, login_method, is_active, created_at, currency, metric} = request.body

    try{
        const {rows} = await fastify.pg.query(
            'SELECT email FROM users WHERE id=$1;',
            [id]
        )
        
        if(rows.rowCount > 0)
        {
            const {currencyIDRows} = await fastify.pg.query('SELECT id FROM currencies WHERE symbol=$1;', [currency])

            if(currencyIDRows.rowCount > 0)
            {
                const currencyID = currencyIDRows[0].id

                const {rows} = await fastify.pg.query(
                    'UPDATE users SET email=$2, password=$3, login_method=$4, is_active=$5, created_at=$6, currency_id=$7, metric=$8 WHERE users.id=$1 RETURNING *;',
                    [id, email, password, login_method, is_active, created_at, currencyID, metric]
                )

                if(rows.rowCount > 0)
                {
                    reply.status(200).send({success});
                }

                reply.status(401).send({error: 'updating user went wrong'})
            }

            reply.status(401).send({error: 'currencyID is wrong'})
        }
        else
        {
            reply.status(401).send({error: 'user does not exist'})
        }

    }
    catch{
        reply.status(400).send({error: 'request failed'})
    }
})


fastify.post('/api/product', {preHandler: [fastify.authenticate]}, async(request, reply)=>{
    const {serverId, productname, barcode, description, price, size, unit, currency, photoname} = request.body

    //created_at and photo are added later; owner_id is added via JWT, and product_id is added from products; If barcode is accessible add it to products
    //procedure: the server will respond a simple list of all products that are saved on it (serverID in App)
    //           IF a product is not in the list, it will be uploaded via here
    //           IF there is a product on the Server but not on the device, the device will call a delete Method
    //

    try{

        //Decodes JWT to email
        const token = request.headers.split(' ')[1];
        const decoded = fastify.jwt.decode(token);
        const email = decoded.username;
        

        //checks if barcode is already registered / if no barcode is provided (0) it will hopefully return the id = 0
        const {rows} = await fastify.pg.query(
            'SELECT id FROM products WHERE barcode=$1;',
            [barcode]
        );

        //gets product id from table products
        var product_id = rows[0].id;

        //if no product is registered with the barcode 
        if(rows.rowCount == 0)
        {
            //will only be executed if barcode is not 0
            const {rows} = await fastify.pg.query('INSERT INTO products (name, barcode) VALUES ($1, $2) RETURNING id;',
                [productname, barcode]
            )


            // resets product_id
            product_id = rows[0].id
        }
      

        //get the user_id from users table
        const user_id_rows = await fastify.pg.query('SELECT id FROM users WHERE email=$1', [email]);
        const user_id = user_id_rows.rows[0].id

        //selects product from id (if id == 0, no product will be returned)
        const {userproducts} = await fastify.pg.query(
            'SELECT * FROM user_products WHERE id=$1;',
            [serverId]
        );
            
        if(userproducts.rowCount > 0)
        {   

            let {rows} = await fastify.pg.query('UPDATE user_products SET custom_name=$2,description=$3, price=$4, size=$5, unit_id=$6, currency_id=$7, photo=$8 WHERE id=$1 RETURNING *;',
                        [serverId, productname, description, price, size, unit, currency, photoname]
                );
                
            if(rows.rowCount == 0)
            {
                reply.status(500).send({error: 'update product failed'});
            }

            reply.status(200).send({productID: rows[0].id});
        
        }
        else
        {
            //Inserts product into the user_products table and lets postgres do the automatic id numbering
            let {rows} = await fastify.pg.query('INSERT INTO user_products (owner_id, product_id, custom_name, description, price, size, unit_id, currency_id, photo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;',
                  [user_id, product_id, productname, description, price, size, unit, currency, photoname]
            );


            //If Row wasnt added:
            if(rows.rowCount == 0)
            {
                //ERROR
               reply.status(500).send({error: 'insert product failed'});
            }

            //response
            reply.status(201).send({productID: rows[0].id})
       }
              
    }
    catch(error)
    {
        reply.status(400).send({error: 'request failed'})
    }
});



fastify.post('/api/category', {preHandler: [fastify.authenticate]}, async(request, reply) => {
    const {categoryname} = request.body

    try
    {
        const token = request.headers.split(' ')[1];
        const decoded = fastify.jwt.decode(token);
        const email = decoded.email;

        const {rows} = await fastify.pg.query(
            'SELECT id FROM users WHERE email=$1;',
            [email]
        );

        if(rows.rowCount > 0)
        {
            const user_id = rows[0].id 

            const {category} = await fastify.pg.query(
                'SELECT name FROM categories WHERE user_id=$1 AND name=$2;',
                [user_id, categoryname]
            );

            if(category.rowCount < 0)
            {

                const {response} = await fastify.pg.query(
                    'INSERT INTO categories(user_id, name) VALUES($1, $2) RETURNING *;',
                    [user_id, categoryname]
                );

                if(response.rowCount == 0)
                {
                    reply.status(500).send({error: 'insert category failed'});
                }
                else
                {
                    reply.status(201).send({success});
                }
            }
            else
            {
                reply.status(500).send({error: 'category already exists'})
            }
        }
        else
        {
            reply.status(401).send({error: 'invalid credentials'});
        }


    }
    catch(error)
    {
        reply.status(500).send({error: 'category add failed'});
    }
});
    




//
//  GET Requests
//

fastify.get('/', function handler(request, reply){
    reply.send("WarehouseApp REST API. Authenticate using /login or /signup");
});

fastify.get('/api/user', {preHandler: [fastify.authenticate]}, async(request, reply)=>{
    try 
    {
        const token = request.headers.authorization.split(' ')[1];
        const decoded = fastify.jwt.decode(token);
        
        const result = await fastify.pg.query('SELECT * FROM users WHERE email = $1;', [decoded.username]);
        reply.send(result.rows);
    }
    catch(err)
    {
        reply.status(500).send({error: 'request failed'});
    }

});


fastify.get('/api/currencies', {preHandler: [fastify.authenticate]}, async(request, reply) => {
    
    try{
        const result = await fastify.pg.query('SELECT * FROM currencies;',)
        reply.send(result.rows);
    }
    catch(err)
    {
        reply.status(500).send({error: 'request failed'});
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
        reply.status(500).send({error: 'request failed'});
    }
});


fastify.get('/api/units', {preHandler: [fastify.authenticate]},async(request, reply)=>{       
    try{
        const result = await fastify.pg.query('SELECT * FROM units;',)
        reply.send(result.rows);
    }
    catch(err)
    {
        reply.status(500).send({error: 'request failed'});
    } 
    
});

fastify.get('/api/products', {preHandler: [fastify.authenticate]}, async(request, reply) => {
    

    try{

        const token = request.headers.authorization.split(' ')[1];
        const decoded = fastify.jwt.decode(token);
        const email = decoded.username
        //JOIN Statement needs to be tested

        const result = await fastify.pg.query(
            'SELECT * FROM user_products INNER JOIN products ON products.id=user_products.id INNER JOIN users ON users.id=user_products.owner_id WHERE users.email = $1;',
            [email]
        )

        reply.send({result});
    }
    catch(err)
    {
        reply.status(500).send({error: 'request failed'});
    }
});


//needs to be more efficient (streaming, zipping, etc.)
fastify.get('/api/product', {preHandler: [fastify.authenticate]}, async(request, reply) => {

    const {productid} = req.body 

    try{
        const token = request.headers.authorization.split(' ')[1];
        const decoded = fastify.jwt.decode(token);
        const email = decoded.username
        //JOIN statement required 
        const queryresult = await fastify.pg.query(
            'SELECT * FROM user_products INNER JOIN products ON products.id=user_products.id INNER JOIN users ON users.id=user_products.owner_id  WHERE users.email == $1 AND  user_products.id== $2;',
            [email, productid]
        );
        const result = queryresult[0];
        reply.send({result});
    }
    catch(err)
    {
        reply.status(500).send({error: 'request failed'});
    }
});







//
//  DELETE Requests
//


fastify.delete('/api/user', {preHandler: fastify.authenticate}, async (request, reply) => {
   
    try
    {
        const token = request.headers.split(' ')[1];
        const decodedToken = fastify.jwt.decode(token);
        const email = decodedToken.username

        const {rows} = await fastify.pg.query(
            'SELECT id FROM users WHERE email=$1;'
            , [email]);

        const id = rows[0].id

        await fastify.pg.query('DELETE FROM categories WHERE user_id=$1;', [id]);
        await fastify.pg.query('DELETE FROM user_products WHERE owner_id=$1;', [id]);
        await fastify.pg.query('DELETE FROM users WHERE id=$1;', [id]);

        reply.status(200).send({success});
    }
    catch(error)
    {
        reply.status(500).send({error: 'deletion failed'});
    }
});



fastify.delete('/api/product', {preHandler: fastify.authenticate}, async (request, reply) => {
    const {productid} = request.body

    try
    {

        const {rows} = await fastify.pg.query('SELECT photo FROM user_products WHERE id=$1;',
            [productid]
        );

        const imageName = rows[0].photo;

        deleteImage(image);

        await fastify.pg.query('DELETE FROM user_products WHERE id=$1;',
            [productid]
        );



        reply.status(200).send({success});
    }
    catch(error)
    {
        reply.status(500).send({error: 'deletion failed'});
    }
});


fastify.delete('/api/category', {preHandler: fastify.authenticate}, async (request, reply) => {
    const {categoryname} = request.body
    
    try  
    {
        const token = request.headers.split(' ')[1];
        const decodedToken = fastify.jwt.decode(token);
        const email = decodedToken.username

        const {rows} = await fastify.pg.query(
            'SELECT id FROM users WHERE email=$1;'
            , [email]);

        const id = rows[0].id


        await fastify.pg.query(
            'DELETE FROM categories WHERE user_id=$1 AND name=$2;',
            [id, categoryname]
        );


        reply.status(200).send({success});
    }
    catch(error)
    {
        reply.status(500).send({error: 'deletion failed'});
    }
});




function saveImage(image, path)
{
    
}


function deleteImage(image, path)
{

}





//
//  Server Listen
//

fastify.listen({port: 3000, host: '0.0.0.0'}, (err) => {
    if(err)
    {
        fastify.log.error(err)
        process.exit(1)
    }
    console.log("Server listening on Port 3000")
    console.log(process.env)
});




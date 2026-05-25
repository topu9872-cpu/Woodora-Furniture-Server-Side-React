require('dotenv').config();
const express=require('express');
const cors=require('cors');
const app=express();

const { toNodeHandler } = require("better-auth/node");
const { auth } = require("./auth");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());
port=5000;
const uri=process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



async function run() {

  const client = new MongoClient(uri);

  try {

    await client.connect();
  
   const db = client.db('Woodora-Furniture');
    const productsCollection = db.collection('Products');
    const AddTocartCollection = db.collection('Add_To_Cart');

app.use("/api/auth", toNodeHandler(auth));


app.get('/products/:id', async(req, res)=>{
    const id=req.params.id;
    const result=await productsCollection.findOne({_id: new ObjectId(id)});
    res.json(result);
});

app.get('/products', async(req, res)=>{
    const search=req.query.search;
    console.log(search)
    const query=search ?{name:{$regex: search, $options:'i'}} :{}
    const result=await productsCollection.find(query).toArray();
    res.json(result)
})

// add to cart

app.post('/cart', async(req, res)=>{
    const data=req.body;
const result=await AddTocartCollection.insertOne(data)
res.json(result)
})

app.get('/cart', async(req, res)=>{
    const result=await AddTocartCollection.find().toArray();
    res.json(result);
})

app.delete('/cart/:id', async(req,res)=>{
    const {id}=req.params;
    const result=await AddTocartCollection.deleteOne({_id: new ObjectId(id)});
    res.json(result)
});


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
   
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/',async(req,res)=>{
    res.json('hello world')
});
app.listen(port,()=>{
    console.log(`Example app listening on port ${port}`)
})
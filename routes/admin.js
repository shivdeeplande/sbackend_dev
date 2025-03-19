const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { handleUserSignup, handleUserLogin } = require("../controllers/user");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require("multer");
require('dotenv').config();
const {verifyToken} = require('../middlewares/verifyToken')

const ADMIN_TABLE_NAME = 'admin_dev';

const upload = multer({ storage: multer.memoryStorage() });
const { getAllItems, generateRandomString,hashPassword,
	comparePassword, getLastValue,generateAuthToken,uploadFileToS3, deleteFileFromS3, insertItem, updateItem,filterItemsByQuery, getMultipleItemsByQuery,getSingleItemById, deleteSingleItemById, sendSMSMessage } = require('../service/dynamo');
router.get('/list', verifyToken, async (req, res) => {
	try {
		const items = await getAllItems(ADMIN_TABLE_NAME);
		res.success({data:items.Items})
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});

router.post('/login', async (req, res) => {
	const body = req.body;	
	try {
		if(!body.email){
			res.errors({message:'Email Required'})
		}else if(!body.password){
			res.errors({message:'Password Required'})
		}else {
			const indexName = "emailIndex"
			const keyConditionExpression = "email = :email"
			const expressionAttributeValues = {
				":email":body.email
			}
			const getData = await getMultipleItemsByQuery(ADMIN_TABLE_NAME, indexName, keyConditionExpression, expressionAttributeValues);
			console.log('getData', getData);

			if(getData.Items.length>0){
				const data = getData.Items[0]
				const isValid = await comparePassword(body.password, data.password);
				if(isValid){
					const userPayload = {
						id: data.id,          // User ID
						email: data.email, // Example email
						role: data.role, // Example role
					};				  
					const token = await generateAuthToken(userPayload);
					console.log('Generated JWT:', token);
					data.token = token
					res.success({data:data})
				}else{
					res.errors({message:'invalid credential'})
				}
			}else{
				res.errors({message:'User not found'})
			}
		}
	} catch (err) {
			res.errors({message:'Something went wrong',data:err})

	}
});


router.post('/add', upload.single("file"), async (req, res) => {
	const body = req.body;	
	try {
		if(!body.fullName){
			res.errors({message:'Full Name Required'})
		}else if(!body.email){
			res.errors({message:'Email Required'})
		}else if(!body.mobile){
			res.errors({message:'Mobile Number Required'})
		}else if(!body.dob){
			res.errors({message:'Date of Birth Required'})
		}else if(!body.gender){
			res.errors({message:'Gender Required'})
		}else if(!body.password){
			res.errors({message:'Password Required'})
		}else{
			if(body.email){
				const indexName = "emailIndex"
				const keyConditionExpression = "email = :email"
				const expressionAttributeValues = {
					":email":body.email
				}
				const getData = await getMultipleItemsByQuery(ADMIN_TABLE_NAME, indexName, keyConditionExpression, expressionAttributeValues);
				console.log('getData', getData);
				if(getData.Items.length>0){
					res.errors({message:'User already registered'})
				}else{
					body.id = uuidv4();
					let image = ""
					if(req.file){
						const bucketName = process.env.AWS_S3_BUCKET_NAME;
						const fileContent = req.file.buffer; // File content from Multer
						const key = `${Date.now()}_${req.file.originalname}`; // Unique filename
						const contentType = req.file.mimetype;
						// Upload to S3
						const result = await uploadFileToS3(fileContent, bucketName, key, contentType);
						console.log('result--->',result);
						image= result.Location
						//res.status(200).send({ message: "File uploaded successfully", url: result.Location });
					}
					const hashedPassword = await hashPassword(body.password);
					console.log('Stored Hashed Password:', hashedPassword);
					const role = body.role || 'admin'
					const item = {
						id:body.id,
						fullName:body.fullName,
						email:body.email,
						password:hashedPassword,
						userName:body.fullName.toLowerCase().replaceAll(/\s/g,''),
						role:role,
						email:body.email,
						mobile:body.mobile,
						gender:body.gender,
						dob:body.dob,
						district:body.district || "",
						state:body.state || "",
						image:image,
						isVerifycation:true,
						createDate:new Date().toISOString(),
						updatedDate:new Date().toISOString()
					}
					console.log('item',item);
					
					const newItem = await insertItem(ADMIN_TABLE_NAME, item);
					console.log('newItem', newItem);
					res.success({data:item, message:"admin user registered successfuly"})
				}
			}
		}
	} catch (err) {
		res.errors({message:'Something went wrong',data:err})
	}
});

router.put('/update/:id',verifyToken, upload.single("file"),  async (req, res) => {
	const id = req.params.id;
	const body = req.body;
	try {
		const findUser = await getSingleItemById(ADMIN_TABLE_NAME, id)
		console.log('findUser',findUser);
		if(findUser.Item){
			const data = findUser.Item
			let image = data.image
			if(req.file){			
				const bucketName = process.env.AWS_S3_BUCKET_NAME;
				if(image){
					const key = await getLastValue(image);
					//await deleteFileFromS3(bucketName, key);
				}
				const fileContent = req.file.buffer; // File content from Multer
				const newKey = `${Date.now()}_${req.file.originalname}`; // Unique filename
				const contentType = req.file.mimetype;
				// Upload to S3
				const result = await uploadFileToS3(fileContent, bucketName, newKey, contentType);
				console.log(result);
				image= result.Location				
			}
			//https://riteshkumarfilebucket.s3.eu-north-1.amazonaws.com/1737880358979_smsrequest.png

			//const item = await updateItem(ADMIN_TABLE_NAME, id, body);
			const itemObject = {
				fullName:body.fullName || data.fullName,
				role:body.role || data.role,
				email:body.email || data.email,
				mobile:body.mobile || data.mobile,
				gender:body.gender || data.gender,
				dob:body.dob || data.dob,
				district:body.district || data.gender,
				state:body.state || data.state,
				image:image,
				updatedDate:new Date().toISOString()
			}
			const updatedUser = await updateItem(ADMIN_TABLE_NAME, data.id, itemObject)
			res.success({data:updatedUser})
		}else{
		res.errors({message:'User not found',data:{}})
		}


	} catch (err) {
		console.error(err);
		res.errors({message:'Something went wrong',data:err})
	}
});

router.get('/get/:id', async (req, res) => {
	const id = req.params.id;
	try {
		const item = await getSingleItemById(ADMIN_TABLE_NAME, id);
		res.success({data:item})
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});

router.delete('/delete/:id', async (req, res) => {
	const id = req.params.id;
	try {
		const item = await deleteSingleItemById(ADMIN_TABLE_NAME, id);
		res.success({data:item})
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});
//--------------news--------------------
const NEWS_TABLE_NAME = 'news'
router.get('/news', async (req, res) => {
	try {
		const items = await getAllItems(NEWS_TABLE_NAME);
		const restrictedNews  = items.Items.length>0? items.Items:[]
		res.success({data:restrictedNews})
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});

router.get('/news/:id', async (req, res) => {
	const id = req.params.id;
	try {
		const item = await getSingleItemById(NEWS_TABLE_NAME, id);
		res.success({data:item})
	} catch (err) {
		res.errors({message:'Something went wrong'}) 
	}
});

router.post('/news', verifyToken, upload.single("file"), async (req, res) => {
	const body = req.body;	
	try {
		if(!req.file){
			res.errors({message:'file Required'})
		}else if(!body.title){
			res.errors({message:'title Required'})
		}else if(!body.description){
			res.errors({message:'description Required'})
		}else{
			body.id = uuidv4();		
			const bucketName = process.env.AWS_S3_BUCKET_NAME;
			const fileContent = req.file.buffer; // File content from Multer
			const newKey = `${Date.now()}_${req.file.originalname}`; // Unique filename
			const contentType = req.file.mimetype;
			// Upload to S3
			const result = await uploadFileToS3(fileContent, bucketName, newKey, contentType);
			console.log(result);
			let image= result.Location				
			
			const item = {
				id:body.id,
				image:image,
				title:body.title,
				isVisible:false,
				toggle:body.toggle || "0",
				newsDate:body.newsDate,
				description:body.description,
				like:[],
				comment:[],
				share:[],
				createDate:new Date().toISOString(),
				updatedDate:new Date().toISOString()
			}
			console.log('item',item);
			
			const newItem = await insertItem(NEWS_TABLE_NAME, item);
			console.log('newItem', newItem);
			res.success({data:item, message:"News added successfuly"})
		}
	} catch (err) {
		res.errors({message:'Something went wrong',data:err})
	}
});

router.put('/news/:id',verifyToken, upload.single("file"),  async (req, res) => {
	const id = req.params.id;
	const body = req.body;
	try {
		const findNews = await getSingleItemById(NEWS_TABLE_NAME, id)
		console.log('findNews',findNews);
		if(findNews.Item && req.user.role =='admin'){
			const data = findNews.Item
			let image = data.image
			let like = data.like
			let comment = data.comment
			let share = data.share
			if(req.file){			
				const bucketName = process.env.AWS_S3_BUCKET_NAME;
				if(image){
					const key = await getLastValue(image);
					await deleteFileFromS3(bucketName, key);
				}
				const fileContent = req.file.buffer; // File content from Multer
				const newKey = `${Date.now()}_${req.file.originalname}`; // Unique filename
				const contentType = req.file.mimetype;
				// Upload to S3
				const result = await uploadFileToS3(fileContent, bucketName, newKey, contentType);
				console.log(result);
				image= result.Location				
			}
			if(body.like){
				like = [...data.like, req.user.id]
			}
			
			if(body.comment){
				comment = [...data.comment, {id:req.user.id,comment:body.comment}]
			}
			
			if(body.share){
				share = [...data.share, req.user.id]
			}
			const toggle= (body.toggle==1 || body.toggle==0)?body.toggle:data.toggle
			const itemObject = {
				image:image,
				title:body.title || data.title,
				isVisible:body.isVisible ,
				toggle:toggle,
				newsDate:body.newsDate || data.newsDate,
				description:body.description || data.description,
				like:like,
				comment:comment,
				share:share,
				updatedDate:new Date().toISOString()
			}
			const updated = await updateItem(NEWS_TABLE_NAME, data.id, itemObject)
			res.success({data:updated.Attributes})
		}else{
		res.errors({message:'News not found or you are not authorized to update',data:{}})
		}

	} catch (err) {
		console.error(err);
		res.errors({message:'Something went wrong',data:err})
	}
});

router.delete('/news/:id',verifyToken, async (req, res) => {
	const id = req.params.id;
	try {
		const item = await deleteSingleItemById(NEWS_TABLE_NAME, id);
		res.success({data:item})
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});
module.exports = router;

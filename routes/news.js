const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require("multer");
require('dotenv').config();
const {verifyToken} = require('../middlewares/verifyToken')

const TABLE_NAME = 'news';

const upload = multer({ storage: multer.memoryStorage() });
const { getAllItems, generateRandomString, getLastValue,generateAuthToken,uploadFileToS3, deleteFileFromS3, insertItem, updateItem,filterItemsByQuery, getMultipleItemsByQuery,getSingleItemById, deleteSingleItemById, sendSMSMessage } = require('../service/dynamo');
router.get('/', async (req, res) => {
	try {
		const items = await getAllItems(TABLE_NAME);
		const restrictedNews  = items.Items.length>0? items.Items.filter(val=> val.isVisible=='true'):[]
		res.success({data:restrictedNews})
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});

router.get('/:id', async (req, res) => {
	const id = req.params.id;
	try {
		const item = await getSingleItemById(TABLE_NAME, id);
		res.success({data:item})
	} catch (err) {
		res.errors({message:'Something went wrong'}) 
	}
});

router.post('/', verifyToken, upload.single("file"), async (req, res) => {
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
			
			const newItem = await insertItem(TABLE_NAME, item);
			console.log('newItem', newItem);
			res.success({data:item, message:"News added successfuly"})
		}
	} catch (err) {
		res.errors({message:'Something went wrong',data:err})
	}
});

router.put('/:id',verifyToken, upload.single("file"),  async (req, res) => {
	const id = req.params.id;
	const body = req.body;
	try {
		const findNews = await getSingleItemById(TABLE_NAME, id)
		const userDetails = await getSingleItemById('users', req.user.id);
		console.log('findNews',findNews,userDetails);
		let userName = ''
		let userImage = ''
		if(userDetails.Item){
			userImage = userDetails.Item?.image
			userName = userDetails.Item?.fullName
		}	
		if(findNews.Item){
			const data = findNews.Item
			let image = data.image
			let like = data.like
			let comment = data.comment
			let share = data.share
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
			if(body.like == "true"){
				like = data.like.includes(req.user.id)?[...data.like]:[...data.like, req.user.id]
			}else if(body.like == "false"){
				like = data.like.length>0? data.like.filter(id => id !== req.user.id) :[]
			}
			
			if(body.comment){
				comment = [...data.comment, {id:req.user.id,image:userImage,name:userName,comment:body.comment}]
			}
			
			if(body.share){
				share = data.share.includes(req.user.id)?[...data.share]:[...data.share, req.user.id]
			}
			const toggle= (body.toggle==1 || body.toggle==0)?body.toggle:data.toggle
			const itemObject = {
				image:image,
				title:body.title || data.title,
				toggle:toggle,
				newsDate:body.newsDate || data.newsDate,
				description:body.description || data.description,
				like:like,
				comment:comment,
				share:share,
				updatedDate:new Date().toISOString()
			}
			const updated = await updateItem(TABLE_NAME, data.id, itemObject)
			res.success({data:updated.Attributes})
		}else{
		res.errors({message:'News not found',data:{}})
		}


	} catch (err) {
		console.error(err);
		res.errors({message:'Something went wrong',data:err})
	}
});

router.delete('/:id',verifyToken, async (req, res) => {
	const id = req.params.id;
	try {
		const item = await deleteSingleItemById(TABLE_NAME, id);
		res.success({data:item})
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});

module.exports = router

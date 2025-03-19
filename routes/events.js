const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require("multer");
require('dotenv').config();
const {verifyToken} = require('../middlewares/verifyToken')

const TABLE_NAME = 'events_dev';

const upload = multer({ storage: multer.memoryStorage() });
const { getAllItems, generateRandomString, getLastValue,generateAuthToken,uploadFileToS3, deleteFileFromS3, insertItem, updateItem,filterItemsByQuery, getMultipleItemsByQuery,getSingleItemById, deleteSingleItemById, sendSMSMessage } = require('../service/dynamo');
router.get('/', async (req, res) => {
	try {
		const items = await getAllItems(TABLE_NAME);
		res.success({data:items.Items})
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

router.get('/filter/:eventDate', async (req, res) => {
	const eventDate = req.params.eventDate;
	try {
		const indexName = "eventDateIndex"
		const keyConditionExpression = "eventDate = :eventDate"
		const expressionAttributeValues = {
			":eventDate":eventDate
		}
		const getData = await getMultipleItemsByQuery(TABLE_NAME, indexName, keyConditionExpression, expressionAttributeValues);
		console.log('getData', getData);
		res.success({data:getData.Items || []})
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});

router.post('/', verifyToken, upload.single("file"), async (req, res) => {
	const body = req.body;	
	try {
		if(!body.eventDate){
			res.errors({message:'eventDate Required'})
		}else if(!body.eventStartTime){
			res.errors({message:'eventStartTime Required'})
		}else if(!body.eventEndTime){
			res.errors({message:'eventEndTime Required'})
		}else if(!body.eventTitle){
			res.errors({message:'eventTitle Required'})
		}else if(!body.eventDescription){
			res.errors({message:'eventDescription Required'})
		}else{
			body.id = uuidv4();
			let image = ""
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
			const item = {
				id:body.id,
				eventDate:body.eventDate,
				eventStartTime:body.eventStartTime,
				eventEndTime:body.eventEndTime,
				eventTitle:body.eventTitle,
				eventType:body.eventType,
				eventDescription:body.eventDescription,
				url:body.url,
				toggle:body.toggle  || "0",
				image:image,
				totalJoined:body.totalJoined || 0,
				createDate:new Date().toISOString(),
				updatedDate:new Date().toISOString()
			}
			console.log('item',item);
			
			const newItem = await insertItem(TABLE_NAME, item);
			console.log('newItem', newItem);
			res.success({data:item, message:"Events added successfuly"})
		}
	} catch (err) {
		res.errors({message:'Something went wrong',data:err})
	}
});

router.put('/:id',verifyToken, upload.single("file"),  async (req, res) => {
	const id = req.params.id;
	const body = req.body;
	try {
		const findUser = await getSingleItemById(TABLE_NAME, id)
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
			const toggle= (body.toggle==1 || body.toggle==0)?body.toggle:data.toggle
			
			const itemObject = {
				...body,
				image:image,
				toggle:toggle,
				totalJoined:body.totalJoined || data.totalJoined,
				updatedDate:new Date().toISOString()
			}
			const updated = await updateItem(TABLE_NAME, data.id, itemObject)
			res.success({data:updated.Attributes, message:"events updated successfully"})
		}else{
		res.errors({message:'Events not found',data:{}})
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

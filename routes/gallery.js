const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require("multer");
require('dotenv').config();
const {verifyToken} = require('../middlewares/verifyToken')

const TABLE_NAME = 'gallery_dev';
// Multer file filter (allow images, videos)
const fileFilter = (req, file, cb) => {
	if (
	  file.mimetype.startsWith("image") || 
	  file.mimetype.startsWith("video")
	) {
	  cb(null, true);
	} else {
	  cb(new Error("Only image, video files are allowed"), false);
	}
  };
  
const upload = multer({ storage: multer.memoryStorage(), fileFilter });
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

router.post('/', verifyToken, upload.fields([{ name: "file" }, { name: "video" }]), async (req, res) => {
	const body = req.body;	
	try {
			body.id = uuidv4();		
			const imageFile = req.files.file ? req.files.file[0] : null;
			const videoFile = req.files.video ? req.files.video[0] : null;
			let image = ""
			if(imageFile){			
				const bucketName = process.env.AWS_S3_BUCKET_NAME;
				const fileContent = imageFile.buffer; // File content from Multer
				const newKey = `${Date.now()}_${imageFile.originalname}`; // Unique filename
				const contentType = imageFile.mimetype;
				// Upload to S3
				const result = await uploadFileToS3(fileContent, bucketName, newKey, contentType);
				console.log(result);
				image= result.Location				
			}
			let video = ""
			if(videoFile){			
				const bucketName = process.env.AWS_S3_BUCKET_NAME;
				const fileContent = videoFile.buffer; // File content from Multer
				const newKey = `${Date.now()}_${videoFile.originalname}`; // Unique filename
				const contentType = videoFile.mimetype;
				// Upload to S3
				const result = await uploadFileToS3(fileContent, bucketName, newKey, contentType);
				console.log(result);
				video= result.Location				
			}			
			
			const item = {
				id:body.id,
				title:body.title,
				toggle:body.toggle  || "0",
				image:image,
				video:video,
				createDate:new Date().toISOString(),
				updatedDate:new Date().toISOString()
			}
			console.log('item',item);
			
			const newItem = await insertItem(TABLE_NAME, item);
			console.log('newItem', newItem);
			res.success({data:item, message:"Gallery added successfuly"})
		
	} catch (err) {
		res.errors({message:'Something went wrong',data:err})
	}
});

router.put('/:id',verifyToken, upload.fields([{ name: "file" }, { name: "video" }]),  async (req, res) => {
	const id = req.params.id;
	const body = req.body;
	try {
		const findGallery = await getSingleItemById(TABLE_NAME, id)
		console.log('findGallery',findGallery);
		if(findGallery.Item){
			const data = findGallery.Item
			let image = data.image
			let video = data.video
			const imageFile = req.files.file ? req.files.file[0] : null;
			const videoFile = req.files.video ? req.files.video[0] : null;
			if(imageFile){			
				const bucketName = process.env.AWS_S3_BUCKET_NAME;
				const fileContent = imageFile.buffer; // File content from Multer
				const newKey = `${Date.now()}_${imageFile.originalname}`; // Unique filename
				const contentType = imageFile.mimetype;
				// Upload to S3
				const result = await uploadFileToS3(fileContent, bucketName, newKey, contentType);
				console.log(result);
				image= result.Location				
			}
			if(videoFile){			
				const bucketName = process.env.AWS_S3_BUCKET_NAME;
				const fileContent = videoFile.buffer; // File content from Multer
				const newKey = `${Date.now()}_${videoFile.originalname}`; // Unique filename
				const contentType = videoFile.mimetype;
				// Upload to S3
				const result = await uploadFileToS3(fileContent, bucketName, newKey, contentType);
				console.log(result);
				video= result.Location				
			}	
			const toggle= (body.toggle==1 || body.toggle==0)?body.toggle:data.toggle
			const itemObject = {
				image:image,
				video:video,
				title:body.title || data.title,
				toggle:toggle,
				updatedDate:new Date().toISOString()
			}
			const updated = await updateItem(TABLE_NAME, data.id, itemObject)
			res.success({data:updated.Attributes})
		}else{
		res.errors({message:'User not found',data:{}})
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

const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require("multer");
require('dotenv').config();
const {verifyToken} = require('../middlewares/verifyToken')

const TABLE_NAME = 'faq_dev';

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

router.post('/', verifyToken,async (req, res) => {
	const body = req.body;	
	try {
		if(!body.question){
			res.errors({message:'question Required'})
		}else if(!body.answer){
			res.errors({message:'answer Required'})
		}else{
			body.id = uuidv4();		
			const item = {
				id:body.id,
				question:body.question,
				answer:body.answer,
				createDate:new Date().toISOString(),
				updatedDate:new Date().toISOString()
			}
			console.log('item',item);
			
			const newItem = await insertItem(TABLE_NAME, item);
			console.log('newItem', newItem);
			res.success({data:item, message:"faq added successfuly"})
		}
	} catch (err) {
		res.errors({message:'Something went wrong',data:err})
	}
});

router.put('/:id',verifyToken,  async (req, res) => {
	const id = req.params.id;
	const body = req.body;	
	try {
		const findFaq = await getSingleItemById(TABLE_NAME, id)
		console.log('findFaq',findFaq);
		if(findFaq.Item){
			const data = findFaq.Item
			const itemObject = {
				question:body.question || data.question,
				answer:body.answer || data.answer,
				updatedDate:new Date().toISOString()
			}
			const updated = await updateItem(TABLE_NAME, data.id, itemObject)
			res.success({data:updated.Attributes, message:"faq updated successfuly"})
		}else{
		res.errors({message:'faq not found',data:{}})
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

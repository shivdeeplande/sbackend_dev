const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require("multer");
require('dotenv').config();
const {verifyToken} = require('../middlewares/verifyToken')

const TABLE_NAME = 'termcondition_dev';

const upload = multer({ storage: multer.memoryStorage() });
const { getAllItems, hindiTranslate, generateRandomString, getLastValue,generateAuthToken,uploadFileToS3, deleteFileFromS3, insertItem, updateItem,filterItemsByQuery, getMultipleItemsByQuery,getSingleItemById, deleteSingleItemById, sendSMSMessage } = require('../service/dynamo');
router.get('/', async (req, res) => {
	try {
		const items = await getAllItems(TABLE_NAME);
		res.success({data:items.Items});
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
		if(!body.content){
			res.errors({message:'content Required'})
		}else{
			body.id = uuidv4();		
			const item = {
				id:body.id,
				content:body.content,
				createDate:new Date().toISOString(),
				updatedDate:new Date().toISOString()
			}
			console.log('item',item);
			
			const newItem = await insertItem(TABLE_NAME, item);
			console.log('newItem', newItem);
			res.success({data:item, message:"termcondition added successfuly"})
		}
	} catch (err) {
		res.errors({message:'Something went wrong',data:err})
	}
});

router.put('/:id',verifyToken, upload.single("file"),  async (req, res) => {
	const id = req.params.id;
	const body = req.body;	

	try {
		const findTermCondition = await getSingleItemById(TABLE_NAME, id)
		console.log('findTermCondition',findTermCondition);
		if(findTermCondition.Item){
			const itemObject = {
				content:body.content,
				updatedDate:new Date().toISOString()
			}
			const updated = await updateItem(TABLE_NAME, id, itemObject)
			res.success({data:updated.Attributes, message:"termcondition updated successfuly"})
		}else{
		res.errors({message:'termcondition not found',data:{}})
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

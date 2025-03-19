const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require("multer");
require('dotenv').config();
const {verifyToken} = require('../middlewares/verifyToken')

const TABLE_NAME = 'mission_dev';

const upload = multer({ storage: multer.memoryStorage() });
const { getAllItems, insertItem, updateItem,getSingleItemById, deleteSingleItemById } = require('../service/dynamo');
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

router.post('/', verifyToken, async (req, res) => {
	const body = req.body;	
	try {
		if(!body.content){
			res.errors({message:'content Required'})
		}else{
			body.id = uuidv4();					
			const item = {
				id:body.id,
				toggle:body.toggle || 0,
				content:body.content,
				createDate:new Date().toISOString(),
				updatedDate:new Date().toISOString()
			}
			console.log('item',item);
			
			const newItem = await insertItem(TABLE_NAME, item);
			console.log('newItem', newItem);
			res.success({data:item, message:"Mission added successfuly"})
		}
	} catch (err) {
		res.errors({message:'Something went wrong',data:err})
	}
});

router.put('/:id',verifyToken,   async (req, res) => {
	const id = req.params.id;
	const body = req.body;
	try {
		const findMission = await getSingleItemById(TABLE_NAME, id)
		console.log('findMission',findMission);
		if(findMission.Item){
			const data = findMission.Item
			const toggle= (body.toggle===1 || body.toggle===0)?body.toggle:data.toggle
			const itemObject = {
				content:body.content,
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

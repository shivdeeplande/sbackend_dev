const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require("multer");
require('dotenv').config();
const {verifyToken} = require('../middlewares/verifyToken')

const TABLE_NAME = 'contactus';

const upload = multer({ storage: multer.memoryStorage() });
const { getAllItems, insertItem, updateItem,filterItemsByQuery, getMultipleItemsByQuery,getSingleItemById, deleteSingleItemById, sendSMSMessage } = require('../service/dynamo');
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

router.post('/',async (req, res) => {
	const body = req.body;	
	try {
		if(!body.name){
			res.errors({message:'name Required'})
		}else if(!body.email){
			res.errors({message:'email Required'})
		}else if(!body.mobile){
			res.errors({message:'mobile Required'})
		}else if(!body.description){
			res.errors({message:'description Required'})
		}else{
			body.id = uuidv4();		
			const item = {
				id:body.id,
				name:body.name,
				email:body.email,
				mobile:body.mobile,
				description:body.description,
				createDate:new Date().toISOString(),
				updatedDate:new Date().toISOString()
			}
			console.log('item',item);
			
			const newItem = await insertItem(TABLE_NAME, item);
			console.log('newItem', newItem);
			res.success({data:item, message:"contact us added successfuly"})
		}
	} catch (err) {
		res.errors({message:'Something went wrong',data:err})
	}
});

router.put('/:id',verifyToken,  async (req, res) => {
	const id = req.params.id;
	const body = req.body;	
	try {
		const findContactus = await getSingleItemById(TABLE_NAME, id)
		console.log('findContactus',findContactus);
		if(findContactus.Item){
			const data = findContactus.Item
			const itemObject = {
				name:body.name || data.name,
				email:body.email || data.email,
				mobile:body.mobile || data.mobile,
				description:body.description || data.description,
				updatedDate:new Date().toISOString()
			}
			const updated = await updateItem(TABLE_NAME, data.id, itemObject)
			res.success({data:updated.Attributes, message:"contact us updated successfuly"})
		}else{
		res.errors({message:'contact us not found',data:{}})
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

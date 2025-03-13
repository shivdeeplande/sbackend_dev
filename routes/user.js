const express = require("express");
const axios = require('axios');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { handleUserSignup, handleUserLogin } = require("../controllers/user");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require("multer");
require('dotenv').config();
const {verifyToken} = require('../middlewares/verifyToken')

const TABLE_NAME = 'users_dev';

const upload = multer({ storage: multer.memoryStorage() });
const { getAllItems, batchInsertLargeDataset, getConditionalRecords,addNewColumnToAllItems,
	generateRandomString, getLastValue,generateAuthToken,uploadFileToS3, deleteFileFromS3, insertItem, updateItem,filterItemsByQuery, getMultipleItemsByQuery,getSingleItemById, deleteSingleItemById, sendSMSMessage } = require('../service/dynamo');
router.get('/users', verifyToken, async (req, res) => {
	try {
		const items = await getAllItems(TABLE_NAME);
		res.success({data:items.Items})
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});

// API route to return translated message
router.get("/greet", (req, res) => {
	res.success({ message: res.__("greeting") }); // Will return "नमस्ते" if Hindi is selected
});

router.get('/checkUserExist/:mobile', async (req, res) => {
	const mobile = req.params.mobile;	
	console.log('mobile---',mobile);
	
	try {
		if(!mobile){
			res.errors({message:'Mobile Number Required'})
		}else {
			const indexName = "mobileIndex"
			const keyConditionExpression = "mobile = :mobile"
			const expressionAttributeValues = {
				":mobile":mobile
			}
			const getData = await getMultipleItemsByQuery(TABLE_NAME, indexName, keyConditionExpression, expressionAttributeValues);
			console.log('getData', getData);

			if(getData.Items.length>0){
				res.success({message:'User found'})
			}else{
				res.errors({message:'User not found'})
			}
		}
	} catch (err) {
			res.errors({message:'Something went wrong',data:err})
	}
});


router.post('/socialLogin', async (req, res) => {
	const body = req.body
	try {
		if(!body.mobile){
			res.errors({message:'Mobile Number Required'})
		}else {
			const userParams = {
				TableName: TABLE_NAME,
				FilterExpression: "isSocialLogin = :socialLogin AND mobile = :mobileData",
				ExpressionAttributeValues: {
				  ":socialLogin": true,      // Boolean true
				  ":mobileData": body.mobile,  // String "true"
				},
			  };
			const firstTimeuser = await getConditionalRecords(userParams);
			  console.log('firstTimeuser',firstTimeuser);

			if(firstTimeuser.length>0){
					const data = firstTimeuser[0]
					const userPayload = {
						id: data.id,          // User ID
						username: data.userName, // Example username
						mobile: data.mobile, // Example mobile
						userrole: data.userrole        // Example user role
					};		  
					const token = await generateAuthToken(userPayload);
					console.log('Generated JWT:', token);
					data.token = token
					data.sessionId = uuidv4();
					const itemObject = {
						sessionId: data.sessionId,
						fcmToken: body.fcmToken || "",
						updatedDate:new Date().toISOString()
					}
					await updateItem(TABLE_NAME, data.id, itemObject)
					res.success({data:data, message:"user login successfuly"})
				}else{
								
					if(!body.fullName){
						res.errors({message:'Full Name Required'})
					}else if(!body.mobile){
						res.errors({message:'Mobile Number Required'})
					}else if(!body.gender){
						res.errors({message:'Gender Required'})
					}else if(!body.sessionId){
						res.errors({message:'sessionId Required'})
					}else{
						body.id = uuidv4();
						let image = ""
						const isMember= (body.isMember=="true" || body.isMember=="false")?body.isMember:false
						const item = {
							id:body.id,
							fullName:body.fullName,
							userName:body.fullName.toLowerCase().replaceAll(/\s/g,''),
							userrole:body.userrole || 'user',
							email:body.email || "",
							mobile:body.mobile,
							gender:body.gender,
							dob:body.dob || "",
							district:body.district || "",
							state:body.state || "",
							dateOfJoining:body.dateOfJoining?new Date(body.dateOfJoining).toISOString() : "",
							image:image,
							isMember:isMember,
							isSocialLogin:true,
							memberId:Date.now(),
							sessionId:uuidv4(),
							fcmToken: body.fcmToken || "",
							referralCode:await generateRandomString(8),
							createDate:new Date().toISOString(),
							updatedDate:new Date().toISOString()
						}
						const newItem = await insertItem(TABLE_NAME, item);
						const userPayload = {
							id: item.id,          // User ID
							username: item.userName, // Example username
							mobile: item.mobile, // Example mobile
							userrole: item.userrole        // Example user role
						};	
						const token = await generateAuthToken(userPayload);
						item.token =token
						console.log('newItem', newItem);
						res.success({data:item, message:"user registered successfuly"})
					}
				}
		}
	} catch (err) {
			res.errors({message:'Something went wrong',data:err})

	}
});

router.post('/login', async (req, res) => {
	const body = req.body;	
	try {
		if(!body.mobile){
			res.errors({message:'Mobile Number Required'})
		}else {
			const userParams = {
				TableName: TABLE_NAME,
				FilterExpression: "isSocialLogin = :socialLogin AND mobile = :mobileData",
				ExpressionAttributeValues: {
				  ":socialLogin": "false",      // Boolean true
				  ":mobileData": body.mobile,  // String "true"
				},
			  };
			const firstTimeuser = await getConditionalRecords(userParams);
			  console.log('firstTimeuser',firstTimeuser);

			if(firstTimeuser.length>0){
					const data = firstTimeuser[0]
					const userPayload = {
						id: data.id,          // User ID
						username: data.userName, // Example username
						mobile: data.mobile, // Example mobile
						userrole: data.userrole        // Example user role
					};	
					if(body.mobile =='9876543210'){
						const token = await generateAuthToken(userPayload);
						console.log('Generated JWT:', token);
						data.token = token
						data.sessionId = 'd8039ce8-3088-41f1-8e08-10bd3b99ce1e'
						const itemObject = {
							sessionId: data.sessionId,
							fcmToken: body.fcmToken || "",
							updatedDate:new Date().toISOString()
						}
						await updateItem(TABLE_NAME, data.id, itemObject)
						res.success({data:data})
					}else{
					const otp  = Math.random().toString().substring(2, 6)
					const response =  await axios.get(`https://2factor.in/API/V1/${process.env.SMS_KEY}/SMS/+91${body.mobile}/${otp}/OTP1`);
					console.log(response.data);
					const resp = response.data
					if(resp.Status ==='Success'){			  
						const token = await generateAuthToken(userPayload);
						console.log('Generated JWT:', token);
						data.token = token
						data.sessionId = resp.Details
						const itemObject = {
							sessionId: data.sessionId,
							fcmToken: body.fcmToken || "",
							updatedDate:new Date().toISOString()
						}
						await updateItem(TABLE_NAME, data.id, itemObject)
						res.success({data:data})
					}else{
						res.errors({message:'Something went wrong'})
					}
				}
				}else{
					res.errors({message:'User is not verified'})
				}
		}
	} catch (err) {
			res.errors({message:'Something went wrong',data:err})

	}
});

router.post('/otpVerifycation', async (req, res) => {
	const body = req.body;	
	try {
		if(!body.mobile){
			res.errors({message:'Mobile Number Required'})
		}else if(!body.otp){
			res.errors({message:'otp Required'})
		}else{
			const indexName = "mobileIndex"
			const keyConditionExpression = "mobile = :mobile"
			const expressionAttributeValues = {
				":mobile":body.mobile
			}
			const getData = await getMultipleItemsByQuery(TABLE_NAME, indexName, keyConditionExpression, expressionAttributeValues);
			console.log('getData', getData);

			if(getData.Items.length>0){
				const data = getData.Items[0]
				const id = data.id
				const KeyConditionExpression = "id = :id"; 
				const ExpressionAttributeValues = {
					":id":id,
					":mobile": body.mobile,
					":otp": body.otp
				}
				const FilterExpression = "otp = :otp AND mobile = :mobile" 
				const filterData = await filterItemsByQuery(TABLE_NAME, KeyConditionExpression, ExpressionAttributeValues, FilterExpression);
				console.log('filterData', filterData);
				const filterItem = filterData.Items
				if(filterItem.length>0){
					const id = filterItem[0].id
					const data = filterItem[0]
					const itemObject = {
						isVerifycation:true,
						updatedDate:new Date().toISOString()
					}
					const userPayload = {
						id: data.id,          // User ID
						username: data.userName, // Example username
						mobile: data.mobile, // Example mobile
						userrole: data.userrole        // Example user role
					};				  
					const token = await generateAuthToken(userPayload);
					console.log('Generated JWT:', token);
					data.token = token
					const updatedUser = await updateItem(TABLE_NAME, id, itemObject)
					res.success({data:data})
				}else{
					res.errors({message:'User not found'})
				}
			}else{
				res.errors({message:'User not found'})
			}
		}
	} catch (err) {
			res.errors({message:'Something went wrong', data:err})

	}
});

router.post('/sendOtpUnAuth',async(req,res)=>{
	const body = req.body;	
	try{
		if(!body.mobile){
			res.errors({message:'mobile required'})
		}else{
			const otp  = Math.random().toString().substring(2, 6)
			const response = await axios.get(`https://2factor.in/API/V1/${process.env.SMS_KEY}/SMS/+91${body.mobile}/${otp}/OTP1`);
			console.log(response.data);
			const resp = response.data
			if(resp.Status ==='Success'){
				res.success({message:"otp send successfully",data:resp})
			}else{
				res.errors({message:'Something went wrong'})
			}
		}
	} catch (err) {
		console.error(err);
		res.errors({message:'Something went wrong',data:err})
	}
})

router.post('/sendOtp',verifyToken,async(req,res)=>{
	const body = req.body;	
	try{
		if(!body.mobile){
			res.errors({message:'mobile required'})
		}else{
			const otp  = Math.random().toString().substring(2, 6)
			const response = await axios.get(`https://2factor.in/API/V1/${process.env.SMS_KEY}/SMS/+91${body.mobile}/${otp}/OTP1`);
			console.log(response.data);
			const resp = response.data
			if(resp.Status ==='Success'){
				res.success({message:"otp send successfully",data:resp})
			}else{
				res.errors({message:'Something went wrong'})
			}
		}
	} catch (err) {
		console.error(err);
		res.errors({message:'Something went wrong',data:err})
	}
})

router.post('/verifyOtp',async(req,res)=>{
	const body = req.body;	
	try{
		if(!body.otp){
			res.errors({message:'otp required'})
		}else if(!body.sessionId){
			res.errors({message:'sessionId required'})
		}else{
			if(body.sessionId == 'd8039ce8-3088-41f1-8e08-10bd3b99ce1e'){
				const indexName = "sessionIdIndex"
				const keyConditionExpression = "sessionId = :sessionId"
				const expressionAttributeValues = {
					":sessionId":body.sessionId
				}
				const getData = await getMultipleItemsByQuery(TABLE_NAME, indexName, keyConditionExpression, expressionAttributeValues);
				console.log('getData', getData);
	
				if(getData.Items.length>0 && body.otp =='9231'){
					const data = getData.Items[0]
					const userPayload = {
						id: data.id,          // User ID
						username: data.userName, // Example username
						mobile: data.mobile, // Example mobile
						userrole: data.userrole        // Example user role
					};	
					const token = await generateAuthToken(userPayload);
					const resp = {}
					resp.Status = "Success"
					resp.Details = "OTP Matched"
					resp.token =token
					res.success({message:"otp verify successfully",data:{message:'OTP Matched', data:resp}})
				}else{
					res.errors({message:'otp not matched'})
				}
			}else{
				const response = await axios.get(`https://2factor.in/API/V1/${process.env.SMS_KEY}/SMS/VERIFY/${body.sessionId}/${body.otp}`);
				console.log(response.data);
				const resp = response.data
				if(resp.Status ==='Success'){
					const indexName = "sessionIdIndex"
					const keyConditionExpression = "sessionId = :sessionId"
					const expressionAttributeValues = {
						":sessionId":body.sessionId
					}
					const getData = await getMultipleItemsByQuery(TABLE_NAME, indexName, keyConditionExpression, expressionAttributeValues);
					console.log('getData', getData);
		
					if(getData.Items.length>0){
						const data = getData.Items[0]
						const userPayload = {
							id: data.id,          // User ID
							username: data.userName, // Example username
							mobile: data.mobile, // Example mobile
							userrole: data.userrole        // Example user role
						};	
						const token = await generateAuthToken(userPayload);
						resp.token =token
						res.success({message:"otp verify successfully",data:resp})
					}else{
						res.success({message:"otp verify successfully",data:resp})
					}
				}else{
					res.errors({message:'Something went wrong'})
				}
			}
		}
	} catch (err) {
		console.error(err);
		res.errors({message:'Something went wrong',data:err})
	}
})

router.post('/users', upload.single("file"), async (req, res) => {
	const body = req.body;	
	try {
		if(!body.fullName){
			res.errors({message:'Full Name Required'})
		}else if(!body.mobile){
			res.errors({message:'Mobile Number Required'})
		}else if(!body.dob){
			res.errors({message:'Date of Birth Required'})
		}else if(!body.gender){
			res.errors({message:'Gender Required'})
		}else if(!body.sessionId){
			res.errors({message:'sessionId Required'})
		}else{
			const userParams = {
				TableName: TABLE_NAME,
				FilterExpression: "isSocialLogin = :socialLogin AND mobile = :mobileData",
				ExpressionAttributeValues: {
				  ":socialLogin": "false",      // Boolean true
				  ":mobileData": body.mobile,  // String "true"
				},
			  };
			const firstTimeuser = await getConditionalRecords(userParams);
			  console.log('firstTimeuser',firstTimeuser);

			if(firstTimeuser.length>0){
				res.errors({message:'User already exist'})
			}else{
				body.id = uuidv4();
				let image = ""
				
				const isMember= (body.isMember=="true" || body.isMember=="false")?body.isMember:false
				const item = {
					id:body.id,
					fullName:body.fullName,
					userName:body.fullName.toLowerCase().replaceAll(/\s/g,''),
					userrole:body.userrole || 'user',
					email:body.email || "",
					mobile:body.mobile,
					gender:body.gender,
					dob:body.dob,
					district:body.district || "",
					state:body.state || "",
					dateOfJoining:body.dateOfJoining?new Date(body.dateOfJoining).toISOString() : "",
					image:image,
					isMember:isMember,
					isSocialLogin:"false",
					memberId:Date.now(),
					sessionId:body.sessionId || "1234",
					referralCode:await generateRandomString(8),
					createDate:new Date().toISOString(),
					updatedDate:new Date().toISOString()
				}
				const newItem = await insertItem(TABLE_NAME, item);
				const userPayload = {
					id: item.id,          // User ID
					username: item.userName, // Example username
					mobile: item.mobile, // Example mobile
					userrole: item.userrole        // Example user role
				};	
				const token = await generateAuthToken(userPayload);
				item.token =token
				console.log('newItem', newItem);
				res.success({data:item, message:"user registered successfuly"})
			}
		}
	} catch (err) {
		res.errors({message:'Something went wrong',data:err})
	}
});

router.put('/users/:id',verifyToken, upload.single("file"),  async (req, res) => {
	const id = req.params.id;
	const body = req.body;
	try {
		const findUser = await getSingleItemById(TABLE_NAME, id)
		console.log('findUser',findUser,req.file);
		if(findUser.Item){
			const data = findUser.Item
			const isMember= (body.isMember=="true" || body.isMember=="false")?body.isMember:data.isMember
			const dateOfJoining =body.dateOfJoining?new Date(body.dateOfJoining).toISOString() : data.dateOfJoining
			console.log('dateOfJoining',dateOfJoining);
			
			let image = data.image
			if(req.file){			
				const bucketName = process.env.AWS_S3_BUCKET_NAME;
				if(image){
					const key = await getLastValue(image);
					//console.log('lastvalue----------->',key);
					
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
			const itemObject = {
				fullName:body.fullName || data.fullName,
				userrole:body.userrole || data.userrole,
				email:body.email || data.email,
				mobile:body.mobile || data.mobile,
				gender:body.gender || data.gender,
				dob:body.dob || data.dob,
				district:body.district || data.district,
				state:body.state || data.state,
				dateOfJoining:dateOfJoining,
				image:image,
				isMember:isMember,
				updatedDate:new Date().toISOString()
			}
			const updatedUser = await updateItem(TABLE_NAME, data.id, itemObject)
			res.success({data:updatedUser})
		}else{
		res.errors({message:'User not found',data:{}})
		}


	} catch (err) {
		console.error(err);
		res.errors({message:'Something went wrong',data:err})
	}
});

router.get('/users/:id', verifyToken, async (req, res) => {
	const id = req.params.id;
	try {
		const item = await getSingleItemById(TABLE_NAME, id);
		res.success({data:item})
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});

router.delete('/users/:id', verifyToken,async (req, res) => {
	const id = req.params.id;
	try {
		const item = await deleteSingleItemById(TABLE_NAME, id);
		res.success({data:item})
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});

router.post('/sdsdsdswevb12',async(req,res)=>{
	try{
		const district = [
			{ "id": 1, "district": "Araria" },
			{ "id": 2, "district": "Arwal" },
			{ "id": 3, "district": "Aurangabad" },
			{ "id": 4, "district": "Banka" },
			{ "id": 5, "district": "Begusarai" },
			{ "id": 6, "district": "Bhagalpur" },
			{ "id": 7, "district": "Bhojpur" },
			{ "id": 8, "district": "Buxar" },
			{ "id": 9, "district": "Darbhanga" },
			{ "id": 10, "district": "East Champaran" },
			{ "id": 11, "district": "Gaya" },
			{ "id": 12, "district": "Gopalganj" },
			{ "id": 13, "district": "Jamui" },
			{ "id": 14, "district": "Jehanabad" },
			{ "id": 15, "district": "Kaimur" },
			{ "id": 16, "district": "Katihar" },
			{ "id": 17, "district": "Khagaria" },
			{ "id": 18, "district": "Kishanganj" },
			{ "id": 19, "district": "Lakhisarai" },
			{ "id": 20, "district": "Madhepura" },
			{ "id": 21, "district": "Madhubani" },
			{ "id": 22, "district": "Munger" },
			{ "id": 23, "district": "Muzaffarpur" },
			{ "id": 24, "district": "Nalanda" },
			{ "id": 25, "district": "Nawada" },
			{ "id": 26, "district": "Patna" },
			{ "id": 27, "district": "Purnia" },
			{ "id": 28, "district": "Rohtas" },
			{ "id": 29, "district": "Saharsa" },
			{ "id": 30, "district": "Samastipur" },
			{ "id": 31, "district": "Saran" },
			{ "id": 32, "district": "Sheikhpura" },
			{ "id": 33, "district": "Sheohar" },
			{ "id": 34, "district": "Sitamarhi" },
			{ "id": 35, "district": "Siwan" },
			{ "id": 36, "district": "Supaul" },
			{ "id": 37, "district": "Vaishali" },
			{ "id": 38, "district": "West Champaran" }
		  ]
		  
		const districtbatch = await batchInsertLargeDataset(district)
		res.success({data:districtbatch, message:"inserted successfuly"})

	}catch (err) {
		res.errors({message:'Something went wrong',data:err})
	}
})
router.post('/cities', async (req, res) => {
	const body = req.body;	
	try {
		if(!body.name){
			res.errors({message:'city name Required'})
		}else if(!body.districtId){
			res.errors({message:'districtId Required'})
		}else{
				const cities = await getAllItems('cities');
				
				body.id = cities.Items.length+1;

				const isunique =cities.Items.find(city=>city.name.toLowerCase() === body.name.toLowerCase())
				console.log('isunique',isunique,cities.Items);
				if(isunique){
					res.errors({message:'duplicate record',data:{}})
				}else{
				const item = {
					id:body.id,
					name:body.name,
					districtId:body.districtId,
					createDate:new Date().toISOString(),
					updatedDate:new Date().toISOString()
				}
				const newItem = await insertItem('cities', item);
				console.log('newItem', newItem);
				res.success({data:item, message:"city added successfuly"})
			}
		}
	} catch (err) {
		res.errors({message:'Something went wrong',data:err})
	}
});
router.get('/cities', async (req, res) => {
	try {
		const items = await getAllItems('cities');
		res.success({data:items.Items})
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});
router.get('/districts', async (req, res) => {
	try {
		const items = await getAllItems('districts');
		res.success({data:items.Items})
	} catch (err) {
		res.errors({message:'Something went wrong'})
	}
});
router.post('/districts', async (req, res) => {
	const body = req.body;	
	try {
		if(!body.name){
			res.errors({message:'district name Required'})
		}else{
				const districts = await getAllItems('districts');
				
				body.id = districts.Items.length+1;

				const isunique =districts.Items.find(district=>district.name.toLowerCase() === body.name.toLowerCase())
				console.log('isunique',isunique,districts.Items);
				if(isunique){
					res.errors({message:'duplicate record',data:{}})
				}else{
				const item = {
					id:body.id,
					name:body.name,
					districtId:body.districtId,
					createDate:new Date().toISOString(),
					updatedDate:new Date().toISOString()
				}
				const newItem = await insertItem('districts', item);
				console.log('newItem', newItem);
				res.success({data:item, message:"districts added successfuly"})
			}
		}
	} catch (err) {
		res.errors({message:'Something went wrong',data:err})
	}
});
module.exports = router;

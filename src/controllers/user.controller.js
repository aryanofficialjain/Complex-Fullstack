import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiErrors.js"
import { User } from "../models/user.model.js";
import {uploadCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req,res)=> {
    // get user details email username password
    // check the validation if any field is empty or not 
    // check if the user is existing account or nor with username and with email
    //  checks for image and avatar 
    // upload them into cloudinary, avatar
    // create user object and create entry in db
    // check user creation 
    // return response


    const {email, fullName, password, username} = req.body
    console.log("email", email)

    if([fullName, email, password, username].some((field)=> field?.trim() === "")){
        throw new ApiError(400, "All fields are required")
    }

    const existingUser = User.findOne({
        $or: [{username, email}]
    })

    if(existingUser){
        throw new ApiError (409, "User with email or username already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")

    }

    const avatar  = await uploadCloudinary(avatarLocalPath);
    const coverImage = await uploadCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user = User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })


    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    ) 

    if(!createdUser){
        throw new ApiError(500, "something went wrong while registering the user");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Sucesfully ")
    )


})

export {registerUser}

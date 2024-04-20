import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrors.js"
import { User } from "../models/user.model.js";
import { uploadCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"



// modeule fucntions to genrate the asscess token and refresh token 

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token ")
    }
}


const registerUser = asyncHandler(async (req, res) => {
    // get user details email username password
    // check the validation if any field is empty or not 
    // check if the user is existing account or nor with username and with email
    //  checks for image and avatar 
    // upload them into cloudinary, avatar
    // create user object and create entry in db
    // check user creation 
    // return response


    const { email, fullName, password, username } = req.body
    console.log("email", email)

    if ([fullName, email, password, username].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required")
    }

    const existingUser = await User.findOne({
        $or: [{ username, email }]
    })

    if (existingUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")

    }

    const avatar = await uploadCloudinary(avatarLocalPath);
    const coverImage = await uploadCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
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

    if (!createdUser) {
        throw new ApiError(500, "something went wrong while registering the user");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Sucesfully ")
    )


})

const loginUser = asyncHandler(async (req, res) => {
    // req body data 
    // check user name and email is avavalble or not 
    // find the user 
    // password check 
    // phir generate access and refresh token and generate and send them to user
    // send the tokens in the cookies 
    // send response that suceesfully logged in

    const { email, username, password } = req.body
    console.log(email, password, username);

    if (!username) {
        throw new ApiError(400, "Username or email is required")
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "User doesnot exits")
    }

    const passwordValid = await user.ispasswordCorrect(password)

    if (!passwordValid) {
        throw new ApiError(401, "invalid password")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    const loggedinUser = await User.findById(user._id).select("-password -refreshToken ")

    const options = {
        httpOnly: true,
        secure: true
    }


    return res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", refreshToken, options).json(new ApiResponse(200, { user: loggedinUser, accessToken, refreshToken }, "User logged in sucesfully"))





})


const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id, {
        $set: {
            refreshToken: undefined
        }
    },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken", options).json(new ApiResponse(200, {}, "User logged Out"))

})


const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        const incomingRefreshToken = req.body.refreshToken || req.body.refreshToken

        if (!incomingRefreshToken) {
            throw new ApiError(401, "unauthorized request")
        }

        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new ApiError(401, "Invalid refresh token")

        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }


        const options = {
            httpOnly: true,
            secure: ture
        }

        const { NewrefreshToken, accessToken } = await generateAccessAndRefreshTokens(user._id);

        return res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", NewrefreshToken)
            .json(new ApiResponse(200, { accessToken, refreshToken: NewrefreshToken }, "Access token refreshed"))
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})




export { registerUser, loginUser, logoutUser, refreshAccessToken }

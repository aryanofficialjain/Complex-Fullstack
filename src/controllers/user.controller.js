import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrors.js"
import { User } from "../models/user.model.js";
import { uploadCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";



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

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body

    if (!(newPassword === confirmPassword)) {
        throw new ApiError(401, "Password or confirm password is not same ")
    }

    console.log(req.user)

    const user = await User.findById(req.user?._id)

    const ispasswordCorrect = await user.ispasswordCorrect(oldPassword)

    if (!ispasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res.status(200).json(new ApiResponse(200, {}, "Password change succesfully"))



})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(200, req.user, "current user fetch successfully")
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        { new: true }
    ).select("-password")

    return res.status(200).json(new ApiResponse(200, user, "Account details updated succesfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing ")
    }

    const avatar = await uploadCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uloading on avatar ")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id, {
        $set: {
            avatar: avatar.url
        }
    }, { new: true }
    ).select("-password")


    return res.status(200).json(200, user, "avatar image changed succesfully ")
})

const updateUsercoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "cover Image file is missing ")
    }

    const coverImage = await uploadCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uloading on coverImage ")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id, {
        $set: {
            coverImage: coverImage.url
        }
    }, { new: true }
    ).select("-password")


    return res.status(200).json(200, user, "cover  image changed succesfully ")
})


const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing ")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },

        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },

        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },

        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },

        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
            }
        }
    ])


    if (!channel?.length) {
        throw new ApiError(404, "channel does not exits ")

    }

    return res.status(200).json(new ApiResponse(200, channel[0], "User channel fetched sussesfully"))

})


const getWatchHistory = asyncHandler(async(req,res)=> {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "owner",
                        pipeline: [
                            {
                                $project: {
                                    fullName: 1,
                                    username: 1,
                                    avatar: 1
                                }
                            }
                        ]
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner",

                            }
                        }
                    }
                ]
            }
        }

    ])

    return res.status(200).json( new ApiResponse, 200, user[0].watchHistory, "Watch history fetched succesfully" )

})

export { registerUser, updateUserAvatar, updateUsercoverImage, getWatchHistory, getUserChannelProfile,   loginUser, logoutUser, refreshAccessToken, updateAccountDetails, getCurrentUser, changeCurrentPassword }

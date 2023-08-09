const express = require("express");

const { requireAuth } = require("../../utils/auth");
const {
  User,
  Spot,
  SpotImage,
  Review,
  ReviewImage,
} = require("../../db/models");

const { check } = require("express-validator");
const { handleValidationErrors } = require("../../utils/validation");

const router = express.Router();

// Route to get all reviews of current user
router.get("/current", requireAuth, async (req, res) => {
  const reviews = await Review.findAll({
    where: {
      userId: req.user.id,
    },
    include: [
      {
        model: User,
        attributes: ["id", "firstName", "lastName"],
      },
      {
        model: Spot,
        // Not needed
        // attributes: [
        //   "id",
        //   "ownerId",
        //   "address",
        //   "city",
        //   "state",
        //   "country",
        //   "lat",
        //   "lng",
        //   "name",
        //   "price",
        // ],
        include: [
          {
            model: SpotImage,
            attributes: ["url"],
          },
        ],
      },
      {
        model: ReviewImage,
        attributes: ["id", "url"],
      },
    ],
    // Not needed
    // attributes: [
    //   "id",
    //   "userId",
    //   "spotId",
    //   "review",
    //   "stars",
    //   "createdAt",
    //   "updatedAt",
    // ],
  });

  // Transform the reviews
  const formattedReviews = reviews.map((review) => ({
    id: review.id,
    userId: review.userId,
    spotId: review.spotId,
    review: review.review,
    stars: review.stars,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    User: review.User,
    Spot: {
      id: review.Spot.id,
      ownerId: review.Spot.ownerId,
      address: review.Spot.address,
      city: review.Spot.city,
      state: review.Spot.state,
      country: review.Spot.country,
      lat: review.Spot.lat,
      lng: review.Spot.lng,
      name: review.Spot.name,
      price: review.Spot.price,
      previewImage:
        review.Spot.SpotImages.length > 0 ? review.Spot.SpotImages[0].url : "",
    },
    ReviewImages: review.ReviewImages,
  }));

  const reviewsResponse = { Reviews: formattedReviews };

  return res.status(200).json(reviewsResponse);
});

// Route to add image to review based on review id
router.post("/:reviewId/images", requireAuth, async (req, res) => {
  const { user } = req;
  const { url } = req.body;

  let review = await Review.findByPk(req.params.reviewId, {
    include: [
      {
        model: ReviewImage,
      },
    ],
  });

  if (!review) {
    return res.status(404).json({
      message: "Review couldn't be found",
    });
  }

  if (user.id !== review.userId) {
    return res.status(403).json({
      message: "Forbidden",
    });
  }

  if (review.ReviewImages.length >= 10) {
    return res.status(403).json({
      message: "Maximum number of images for this resource was reached",
    });
  }

  const image = await review.createReviewImage({
    url: url,
  });

  let response = {};
  response.id = image.id;
  response.url = image.url;

  return res.status(200).json(response);
});

module.exports = router;

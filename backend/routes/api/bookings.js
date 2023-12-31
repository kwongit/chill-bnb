const express = require("express");
const { Op } = require("sequelize");

const { requireAuth } = require("../../utils/auth");
const { Spot, SpotImage, Booking } = require("../../db/models");

const { check } = require("express-validator");
const { handleValidationErrors } = require("../../utils/validation");

const router = express.Router();

// Validate date format
const validateDate = (value, { req }) => {
  if (new Date(value) <= new Date(req.body.startDate)) {
    throw new Error("endDate cannot be on or before startDate");
  }
  return true;
};

// Validation middleware for booking creation
const validateBooking = [
  check("endDate").exists({ checkFalsy: true }).custom(validateDate),
  handleValidationErrors,
];

// get all current user's bookings
router.get("/current", requireAuth, async (req, res) => {
  const userId = req.user.id;

  // find all bookings by userId associated with spots, spotImages
  const bookings = await Booking.findAll({
    where: {
      userId,
    },
    include: [
      {
        model: Spot,
        include: [
          {
            model: SpotImage,
            attributes: ["url", "preview"],
          },
        ],
      },
    ],
  });

  // map new bookings array to handle Spot > SpotImage
  const newBookings = bookings.map((booking) => {
    // destructure bookings
    const {
      id,
      // spotId,
      startDate,
      endDate,
      createdAt,
      updatedAt,
      Spot: {
        id: spotId,
        ownerId,
        address,
        city,
        state,
        country,
        lat,
        lng,
        name,
        price,
        SpotImages,
      },
    } = booking;

    let spotImageUrl = "";

    // check if there are SpotImages
    for (const spotImage of SpotImages) {
      if (spotImage.preview) {
        spotImageUrl = spotImage.url;
        break;
      }
    }

    const previewImage = spotImageUrl;

    // return new bookings array of objects
    return {
      id,
      spotId,
      userId,
      startDate,
      endDate,
      createdAt,
      updatedAt,
      Spot: {
        id: spotId,
        ownerId,
        address,
        city,
        state,
        country,
        lat,
        lng,
        name,
        price,
        previewImage,
      },
    };
  });

  // restructure Bookings response
  const response = { Bookings: newBookings };
  return res.status(200).json(response);
});

// edit a booking
router.put("/:bookingId", requireAuth, validateBooking, async (req, res) => {
  const userId = req.user.id;
  const bookingId = req.params.bookingId;
  let { startDate, endDate } = req.body;

  // convert to Date objects
  startDate = new Date(startDate);
  endDate = new Date(endDate);

  // find booking by bookingId
  const booking = await Booking.findByPk(bookingId);

  // check if booking exists
  if (!booking) {
    return res.status(404).json({
      message: "Booking couldn't be found",
    });
  }

  // check if booking belongs to user
  if (userId !== booking.userId) {
    return res.status(403).json({
      message: "Forbidden",
    });
  }

  // check if past the end date
  if (new Date() > booking.endDate) {
    return res.status(403).json({
      message: "Past bookings can't be modified",
    });
  }

  // check booking conflicts
  const existingBooking = await Booking.findOne({
    where: {
      [Op.or]: [
        {
          startDate: {
            [Op.between]: [startDate, endDate],
          },
        },
        {
          endDate: {
            [Op.between]: [startDate, endDate],
          },
        },
      ],
    },
  });

  // if exists, means conflict
  if (existingBooking) {
    return res.status(403).json({
      message: "Sorry, this spot is already booked for the specified dates",
      errors: {
        startDate: "Start date conflicts with an existing booking",
        endDate: "End date conflicts with an existing booking",
      },
    });
  }

  const updatedBooking = await booking.update({
    startDate,
    endDate,
  });

  return res.status(200).json(updatedBooking);
});

// delete a booking
router.delete("/:bookingId", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const bookingId = req.params.bookingId;

  // find booking by bookingId
  const booking = await Booking.findByPk(bookingId);

  // check if booking exists
  if (!booking) {
    return res.status(404).json({
      message: "Booking couldn't be found",
    });
  }

  // check if booking belongs to user
  if (userId !== booking.userId) {
    return res.status(403).json({
      message: "Forbidden",
    });
  }

  // check if date started
  if (booking.startDate < new Date()) {
    return res.status(403).json({
      message: "Bookings that have been started can't be deleted",
    });
  }

  await booking.destroy();

  return res.status(200).json({
    message: "Successfully deleted",
  });
});

module.exports = router;

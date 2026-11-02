// Single source of truth for the services band and the driver page.
// Keep every claim here traceable to the live RideArrivo website. When a product
// changes status on the main site, change it here and nowhere else.
const SITE = 'https://www.ridearrivo.com';

export const OFFERINGS = [
  {
    id: 'airport', group: 'Ride', name: 'Airport transfer', tag: 'Flight-aware pickup',
    summary: 'A driver who is tracking your flight, so a delay does not become a missed pickup.',
    best: 'Arrivals and departures at Lagos airports.',
    points: ['We track your flight, so your driver meets you when you land.', 'You see the fare before you confirm anything.', 'Pay by card, from your wallet, or with a membership.'],
    status: 'Book now', cta: { label: 'Book an airport transfer', href: SITE + '/book.html' }
  },
  {
    id: 'express', group: 'Ride', name: 'Ride now', tag: 'ArrivoExpress, on demand',
    summary: 'Tap, get matched, go. ArrivoExpress is the on-demand way to move around Lagos.',
    best: 'Spur-of-the-moment trips across the city.',
    points: ['Pays from your RideArrivo Wallet, so you need a profile first.', 'Your fare is held in the wallet and refunded automatically if no driver accepts or if you cancel.', 'Driver rollout is still in progress, so scheduled rides are the dependable choice today.'],
    status: 'Rolling out', cta: { label: 'Open ArrivoExpress', href: 'https://express.ridearrivo.com/express?mode=now' }
  },
  {
    id: 'schedule', group: 'Ride', name: 'Schedule a ride', tag: 'Fixed fare, booked ahead',
    summary: 'Book your pickup in advance at a fare you know up front.',
    best: 'Meetings, early flights and anything you cannot be late for.',
    points: ['Choose your pickup time and see the fare before you pay.', 'Cancel 48 hours before pickup for a full refund, or get 50% back after that.', 'Every driver passes ID and licence checks.'],
    status: 'Book now', cta: { label: 'Schedule a ride', href: 'https://express.ridearrivo.com/express?mode=schedule' }
  },
  {
    id: 'chauffeur', group: 'Ride', name: 'Chauffeur', tag: 'A driver by the day or week',
    summary: 'One professional driver for as long as you need, without owning or managing a car.',
    best: 'Guests, executives and busy schedules.',
    points: ['Booked by the day or by the week.', 'Rentals and trips outside the automated booking flow are arranged directly with our Support team.', 'Vehicle choices include standard sedan, SUV, luxury and van or bus.'],
    status: 'Request', cta: { label: 'Request a chauffeur', href: SITE + '/charter-booking.html' }
  },
  {
    id: 'move', group: 'Move', name: 'Home or office move', tag: 'ArrivoRemovals',
    summary: 'A crew and a truck on one booking, instead of three phone calls.',
    best: 'Moving house, flat or office within reach of Lagos.',
    points: ['One booking covers the crew and the truck.', 'Handled by the dedicated ArrivoRemovals service.'],
    status: 'Open site', cta: { label: 'Go to ArrivoRemovals', href: 'https://removals.ridearrivo.com' }
  },
  {
    id: 'boat', group: 'Charter', name: 'Boat charter', tag: 'ArrivoBoat',
    summary: 'Water transfers and events, arranged for you.',
    best: 'Island transfers, celebrations and corporate outings.',
    points: ['Water transfers and event charters.', 'Handled by the dedicated ArrivoBoat service.'],
    status: 'Open site', cta: { label: 'Go to ArrivoBoat', href: 'https://boat.ridearrivo.com' }
  },
  {
    id: 'air', group: 'Charter', name: 'Air charter', tag: 'ArrivoAir',
    summary: 'Private jets, on request.',
    best: 'Time-critical or high-privilege travel.',
    points: ['Private jets arranged on request.', 'Handled by the dedicated ArrivoAir service.'],
    status: 'Open site', cta: { label: 'Go to ArrivoAir', href: 'https://air.ridearrivo.com' }
  },
  {
    id: 'business', group: 'Business', name: 'Business travel', tag: 'Teams and guests',
    summary: 'Airport, chauffeur and business travel for a team or a guest, handled for you.',
    best: 'Companies moving staff, clients or visitors.',
    points: ['Airport, chauffeur and business travel in one place.', 'Talk to us and we shape it around your team.'],
    status: 'Talk to us', cta: { label: 'Talk to the team', href: SITE + '/contact-us.html' }
  },
  {
    id: 'membership', group: 'Membership', name: 'Membership', tag: 'Pay your way',
    summary: 'A membership you can pay with at checkout, alongside card and wallet.',
    best: 'Regular riders.',
    points: ['Membership is one of three ways to pay, with card and wallet.', 'See the plan details on the membership site.'],
    status: 'Open site', cta: { label: 'See membership', href: 'https://membership.ridearrivo.com' }
  }
];

export const DRIVER_APPLY_URL = SITE + '/driver.html';
export const DRIVER_STEPS = [
  ['Apply', 'Create your account, add your vehicle and upload your documents. It takes about 10 minutes.'],
  ['Get reviewed', 'Our team reviews your licence, vehicle and photos. This usually takes a day or two.'],
  ['Hear from us', 'We email you when you are approved. The portal updates the next time you visit.'],
  ['Go online', 'Switch on, receive ride requests and track your trips and earnings in the app.']
];
export const DRIVER_CHECKLIST = [
  'A clear, current profile photo of your face',
  'Your driver’s licence photo, front side, all corners visible',
  'Your vehicle type: sedan, SUV, or truck or van',
  'A WhatsApp number and an emergency contact',
  'Consent to a background check and the independent contractor agreement'
];
export const DRIVER_FAQ = [
  ['Who can see my details?', 'Riders see your name, photo and ID before you arrive. That is why photos need to be clear and current.'],
  ['Is there a safety feature for drivers?', 'Yes. The app has an Emergency Button. Once it is pressed, our operations team is alerted and may activate the in-vehicle listening device. Only our team can clear an alert. Read terms section 10 and privacy policy section 12 for the exact wording.'],
  ['Do I need to own the vehicle?', 'No. The application asks whether the vehicle is yours or someone else’s.'],
  ['Where do I see what I have earned?', 'In the driver app: this month, all-time and completed trips.'],
  ['Which languages can I list?', 'You can list the languages you speak, so riders and Support know how to reach you.']
];
export const SOCIALS = [
  ['WhatsApp', 'https://wa.me/2348162706078'],
  ['Instagram', 'https://www.instagram.com/ridearrivong'],
  ['LinkedIn', 'https://www.linkedin.com/company/ridearrivo/'],
  ['X', 'https://x.com/ridearrivong'],
  ['TikTok', 'https://www.tiktok.com/@ridearrivong']
];

// Driver orientation. This is RideArrivo's proposed standard of service for drivers.
// It is written from the facts on the driver portal (riders see name, photo and ID,
// flight-aware pickups, upfront fares, Emergency Button) and common professional practice.
// Operations should review it before it is published as policy.
export const ORIENTATION = [
  {
    id: 'look', title: 'Your look and how you dress', blurb: 'Riders see your name, photo and ID before you arrive. First impressions start there.',
    do: ['Wear clean, pressed, smart clothes. A collared shirt or plain shirt with trousers, or a native outfit that is neat and in good condition.', 'Wear closed, clean, comfortable shoes you can drive in.', 'Keep your hair and beard neat and your nails clean.', 'Bathe, brush your teeth and use a light deodorant before every shift. Keep a mint or gum in the car.', 'Use the same clear, recent profile photo that riders see in the app, so they recognise you at once.'],
    dont: ['Do not wear vests, slippers, torn or stained clothes, or anything with offensive writing.', 'Do not use strong perfume or cologne. It can make riders unwell in a closed car.', 'Do not wear sunglasses at night or inside the airport pickup area.', 'Do not drive with a cap pulled low over your face.']
  },
  {
    id: 'behaviour', title: 'Behaviour and professionalism', blurb: 'You are the face of RideArrivo for the whole trip.',
    do: ['Be on time. Arrive early enough to be ready when the rider is.', 'Stay calm, patient and respectful, even when traffic or a rider is difficult.', 'Treat every rider the same, whatever their age, gender, tribe, religion or how they dress.', 'Keep a rider’s details, destination and conversations private.', 'Accept feedback gracefully and fix what it points to.'],
    dont: ['Do not argue, shout, insult or respond to provocation. End the trip safely and report it to Support.', 'Do not ask for extra money, tips or cash outside the app fare.', 'Do not discuss politics, religion or personal money with riders.', 'Do not use your phone while driving.', 'Do not drink alcohol or use drugs before or during a shift, and do not drive tired.']
  },
  {
    id: 'talk', title: 'Talking with riders', blurb: 'Warm, short and clear. Let the rider decide how much they want to chat.',
    do: ['Greet by name and confirm the trip: “Good evening, Mr Bello. I am Tunde, your RideArrivo driver. Are we going to Victoria Island?”', 'Offer help with bags before they ask, and open the door for them.', 'Ask once about comfort: “Is the temperature okay for you?”', 'If there is delay or heavy traffic, say so early and calmly: “There is a hold-up on the bridge. I will take the alternate route and keep you updated.”', 'Close with thanks: “Thank you for riding with RideArrivo. Safe evening.”'],
    dont: ['Do not ask personal questions or comment on a rider’s body, family or relationships.', 'Do not push conversation on a rider who is on a call or wants quiet.', 'Do not complain about the company, other riders or other drivers.', 'Do not argue about fares. Direct the rider to the in-app fare breakdown or to Support.']
  },
  {
    id: 'driving', title: 'How to drive', blurb: 'Smooth, safe and predictable. Riders judge a trip by how it feels.',
    do: ['Wear your seatbelt and make sure every rider is buckled before you move.', 'Drive smoothly: gentle braking, gentle acceleration, steady speed.', 'Keep a safe distance and obey speed limits, signals and lane rules.', 'Use the route in the app, and explain if you take a different one for traffic or safety.', 'Park legally and safely for pickups and drop-offs, and never block traffic.'],
    dont: ['Do not overtake dangerously, drive on the shoulder or cross red lights.', 'Do not race other vehicles or use your horn aggressively.', 'Do not eat, smoke or make calls while the rider is in the car.', 'Do not take extra passengers or stop for personal errands during a trip.']
  },
  {
    id: 'airport', title: 'Airport pickups', blurb: 'This is what RideArrivo is known for. Flight-aware pickups mean you are ready when the rider lands.',
    do: ['Check the flight status in the trip details and plan to be at the pickup point before the rider clears arrivals.', 'Greet the rider at arrivals with their name clearly visible, then guide them and their luggage to the car.', 'Message the rider once you are in position with your car description and plate number.', 'Wait through a delay. The system tracks the flight, so you will see the updated time.'],
    dont: ['Do not leave your assigned pickup point or accept a different rider for the same slot.', 'Do not block the arrivals lane or leave your car unattended there.', 'Do not let anyone approach the car offering to carry bags for money on your behalf.']
  },
  {
    id: 'safety', title: 'Safety and emergencies', blurb: 'Your safety and your rider’s come first. Know the tools before you need them.',
    do: ['Know where the Emergency Button is in the driver app. Once it is pressed, RideArrivo is alerted and only our team can clear the alert.', 'Understand that our operations team may activate the in-vehicle listening device after the Emergency Button is pressed. This is described in the terms (section 10) and privacy policy (section 12).', 'Keep your emergency contact up to date. We use it if we cannot reach you.', 'Pull over safely and call Support if you feel unsafe, a rider is unwell, or there is an accident.'],
    dont: ['Do not confront a threatening rider. Prioritise getting to a safe, public place.', 'Do not press the Emergency Button as a test. It triggers a real response.', 'Do not share your login or let someone else drive under your account.']
  },
  {
    id: 'car', title: 'Your car', blurb: 'A clean, working car is half of the experience.',
    do: ['Wash and vacuum the car inside and out, and wipe seats, handles and the dashboard.', 'Keep the air conditioning working and the car smelling fresh.', 'Check tyres, brakes, lights, wipers and fuel before you go online.', 'Carry your driver’s licence, vehicle papers, a phone charger and bottled water.', 'Keep the boot clear so luggage can fit.'],
    dont: ['Do not go online with a warning light, flat tyre, cracked windscreen or faulty seatbelt.', 'Do not leave personal items, food wrappers or religious or political displays in view.', 'Do not use a car that does not match the vehicle details in your application.']
  },
  {
    id: 'checklist', title: 'Before every shift', blurb: 'Two minutes that prevent most complaints.',
    do: ['Phone charged, app updated and location on.', 'Licence and vehicle papers with you.', 'Uniform, shoes, hair and breath checked.', 'Car clean, tyres and fuel okay.', 'Emergency Button located and emergency contact current.', 'Mind rested and sober. Go online only when you are fit to drive.'],
    dont: []
  }
];

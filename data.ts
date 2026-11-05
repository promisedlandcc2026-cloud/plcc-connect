
export const CHURCH_INFO = {
  name: "Promised Land Christian Center",
  motto: "Changing Hearts. Transforming Lives.",
  address: "Kira-Kitukutwe Trading Center, Wakiso District, Uganda",
  phone: "(508) 454-3599",
  email: "info@sanctum-live-nine.vercel.app",
  website: "https://sanctum-live-nine.vercel.app",
  schedule: [
    { day: "Sunday", time: "10:30 AM – 12:30 PM", event: "Sunday Celebration Service" },
    { day: "Wednesday", time: "7:30 PM – 9:30 PM", event: "Mid-Week Empowerment Bible Study" }
  ],
  socials: {
    facebook: "https://www.facebook.com/AWCbelmont",
    instagram: "https://www.instagram.com/awcbelmont/",
    youtube: "https://www.youtube.com/@khiireofficial"
  }
};

/** Public YouTube channel — latest uploads fetched automatically via RSS. */
export const YOUTUBE_CHANNEL_ID = 'UCd7BAXFftbXrKrjiAniwIEQ';
export const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@khiireofficial';

/** Manual fallback only if auto-fetch fails. Leave empty to rely on YouTube RSS. */
export const LATEST_YOUTUBE_VIDEO = '';

export interface OutlinePoint {
  id: number;
  text: string;
  missingWord: string;
}

export interface Sermon {
  date: string;
  title: string;
  scripture: string;
  book: string;
  version: string;
  speaker: string;
  outline: OutlinePoint[];
}

export const SERMON_SCHEDULE: Sermon[] = [
  {
    date: "2025-06-01",
    title: "Walking in Divine Favor",
    scripture: "Psalm 5:12",
    book: "Psalms",
    version: "KJV",
    speaker: "Pastor Grace Hiire",
    outline: [
      { id: 1, text: "For thou, Lord, wilt ________ the righteous.", missingWord: "bless" },
      { id: 2, text: "With favor wilt thou compass him as with a ________.", missingWord: "shield" }
    ]
  },
  {
    date: "2025-06-08",
    title: "Faith for the Future",
    scripture: "Hebrews 11:1-3",
    book: "Hebrews",
    version: "KJV",
    speaker: "Pastor Grace Hiire",
    outline: [
      { id: 1, text: "Faith is the ________ of things hoped for.", missingWord: "substance" },
      { id: 2, text: "Through faith we understand that the worlds were ________.", missingWord: "framed" },
      { id: 3, text: "Without faith it is ________ to please God.", missingWord: "impossible" }
    ]
  },
  {
    date: "2025-06-15",
    title: "The Power of Pentecost",
    scripture: "Acts 2:1-4",
    book: "Acts",
    version: "KJV",
    speaker: "Pastor Grace Hiire",
    outline: [
      { id: 1, text: "They were all with one ________ in one place.", missingWord: "accord" },
      { id: 2, text: "The Holy Spirit appeared as cloven tongues of ________.", missingWord: "fire" },
      { id: 3, text: "They began to speak with other ________.", missingWord: "tongues" }
    ]
  }
];

export const getCurrentSermon = () => {
  const now = new Date();
  const sorted = [...SERMON_SCHEDULE].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const current = sorted.find(s => new Date(s.date) <= now) || sorted[sorted.length - 1];
  return current;
};

export const MINISTRIES = [
  { name: 'Worship', desc: 'Praise & Arts', longDesc: 'Our worship ministry leads the congregation into the presence of God through music and creative arts.' },
  { name: 'Youth', desc: 'Next Gen', longDesc: 'Empowering the next generation to live for Christ in a modern world.' },
  { name: 'Kids', desc: 'PLCC Children', longDesc: 'A safe, fun, and spiritual environment for children to grow in their faith.' },
  { name: 'Outreach', desc: 'Community', longDesc: 'Serving our local community through food drives and local missions.' },
  { name: 'Men\'s', desc: 'Brotherhood', longDesc: 'Building strong men of God through fellowship and discipleship.' },
  { name: 'Women\'s', desc: 'Sisterhood', longDesc: 'A community for women to connect, grow, and serve together.' },
  { name: 'Media', desc: 'Tech & Sound', longDesc: 'Managing the digital and technical aspects of our worship experience.' },
  { name: 'Hospitality', desc: 'Welcome Team', longDesc: 'The first point of contact for every visitor, ensuring everyone feels home.' }
];

export const ANNOUNCEMENTS = [
  {
    id: '1',
    title: '2025 Leadership Summit',
    date: 'June 12-14',
    description: 'Equipping our leaders for a year of unprecedented growth and spiritual depth. Join us for three days of intensive training, spiritual awakening, and strategic planning.',
    imageUrl: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: '2',
    title: 'PLCC Community Food Drive',
    date: 'Every Saturday',
    description: 'Join us as we serve our community through our weekly food distribution ministry. We meet at 8:30 AM in the Fellowship Hall.',
    imageUrl: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&q=80&w=400'
  }
];

export const UPCOMING_EVENTS = [
  {
    id: 'a1b2c3d4-e5f6-4789-a012-202609201400',
    title: 'Fellowship Cookout',
    date: '2026-09-20',
    time: '2:00 PM',
    end_time: '6:00 PM',
    starts_at: '2026-09-20T14:00:00',
    location: 'Church grounds',
    description: 'Join us for food, fellowship, and community as we celebrate together on the church grounds.',
    image_url: '/events/fellowship-cookout.jpg',
    rsvp_enabled: true,
    rsvp_url: 'https://plcc-opal.vercel.app/fellowship-cookout',
  },
  {
    id: '1',
    title: 'Sunday Celebration',
    starts_at: '2026-03-15T10:30:00',
    location: 'Main Sanctuary',
  },
];

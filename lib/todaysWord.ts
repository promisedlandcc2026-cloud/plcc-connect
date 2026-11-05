/**
 * Shared "Today's Word" — inspirational word + meaning + short verse.
 * Same calendar day (Africa/Kampala) → same entry on every device.
 * Optional Vault/admin rows in `daily_inspiration` still override in the UI.
 */

export type TodaysWordEntry = {
  id: string;
  word: string;
  meaning: string;
  verse: string;
  reference: string;
};

/** Acton, MA church calendar day. */
export const CHURCH_TIMEZONE = 'Africa/Kampala';

/** Curated faith-oriented words (~70). Stable ids. */
export const TODAYS_WORD_ENTRIES: TodaysWordEntry[] = [
  { id: 'hope', word: 'Hope', meaning: 'Confident expectation in God\'s promises.', verse: 'May the God of hope fill you with all joy and peace.', reference: 'Romans 15:13' },
  { id: 'grace', word: 'Grace', meaning: 'God\'s unearned favor toward us.', verse: 'My grace is sufficient for you, for my power is made perfect in weakness.', reference: '2 Corinthians 12:9' },
  { id: 'peace', word: 'Peace', meaning: 'Rest that holds even in the storm.', verse: 'Peace I leave with you; my peace I give you.', reference: 'John 14:27' },
  { id: 'faith', word: 'Faith', meaning: 'Trusting God beyond what we see.', verse: 'Now faith is confidence in what we hope for and assurance about what we do not see.', reference: 'Hebrews 11:1' },
  { id: 'love', word: 'Love', meaning: 'Choosing others the way Christ chose us.', verse: 'And now these three remain: faith, hope and love. But the greatest of these is love.', reference: '1 Corinthians 13:13' },
  { id: 'joy', word: 'Joy', meaning: 'Deep gladness rooted in the Lord.', verse: 'The joy of the Lord is your strength.', reference: 'Nehemiah 8:10' },
  { id: 'mercy', word: 'Mercy', meaning: 'Compassion that meets us in our need.', verse: 'The Lord is gracious and compassionate, slow to anger and rich in love.', reference: 'Psalm 145:8' },
  { id: 'strength', word: 'Strength', meaning: 'Power that comes from resting in God.', verse: 'I can do all this through him who gives me strength.', reference: 'Philippians 4:13' },
  { id: 'courage', word: 'Courage', meaning: 'Boldness to follow God without fear.', verse: 'Be strong and courageous. Do not be afraid; do not be discouraged.', reference: 'Joshua 1:9' },
  { id: 'wisdom', word: 'Wisdom', meaning: 'Seeing life through God\'s truth.', verse: 'If any of you lacks wisdom, you should ask God.', reference: 'James 1:5' },
  { id: 'patience', word: 'Patience', meaning: 'Waiting well while God works.', verse: 'Be still before the Lord and wait patiently for him.', reference: 'Psalm 37:7' },
  { id: 'kindness', word: 'Kindness', meaning: 'Gentle goodness toward others.', verse: 'Be kind and compassionate to one another.', reference: 'Ephesians 4:32' },
  { id: 'forgiveness', word: 'Forgiveness', meaning: 'Releasing others as Christ released us.', verse: 'Forgive as the Lord forgave you.', reference: 'Colossians 3:13' },
  { id: 'trust', word: 'Trust', meaning: 'Leaning fully on the Lord\'s care.', verse: 'Trust in the Lord with all your heart.', reference: 'Proverbs 3:5' },
  { id: 'humility', word: 'Humility', meaning: 'Putting God and others first.', verse: 'Humble yourselves before the Lord, and he will lift you up.', reference: 'James 4:10' },
  { id: 'steadfast', word: 'Steadfast', meaning: 'Firm and faithful through every season.', verse: 'Be steadfast, immovable, always abounding in the work of the Lord.', reference: '1 Corinthians 15:58' },
  { id: 'rest', word: 'Rest', meaning: 'Soul quiet found in Jesus.', verse: 'Come to me, all you who are weary and burdened, and I will give you rest.', reference: 'Matthew 11:28' },
  { id: 'light', word: 'Light', meaning: 'Truth that pushes back the dark.', verse: 'I am the light of the world. Whoever follows me will never walk in darkness.', reference: 'John 8:12' },
  { id: 'truth', word: 'Truth', meaning: 'What God says, not what fear says.', verse: 'Then you will know the truth, and the truth will set you free.', reference: 'John 8:32' },
  { id: 'freedom', word: 'Freedom', meaning: 'Life unchained by Christ.', verse: 'It is for freedom that Christ has set us free.', reference: 'Galatians 5:1' },
  { id: 'purpose', word: 'Purpose', meaning: 'Living for what God designed you for.', verse: 'For we are God\'s handiwork, created in Christ Jesus to do good works.', reference: 'Ephesians 2:10' },
  { id: 'provision', word: 'Provision', meaning: 'God meeting needs in His timing.', verse: 'And my God will meet all your needs according to the riches of his glory.', reference: 'Philippians 4:19' },
  { id: 'comfort', word: 'Comfort', meaning: 'God near in every sorrow.', verse: 'The Lord is close to the brokenhearted.', reference: 'Psalm 34:18' },
  { id: 'renewal', word: 'Renewal', meaning: 'Fresh strength for a new day.', verse: 'Those who hope in the Lord will renew their strength.', reference: 'Isaiah 40:31' },
  { id: 'gratitude', word: 'Gratitude', meaning: 'A heart that remembers God\'s gifts.', verse: 'Give thanks in all circumstances.', reference: '1 Thessalonians 5:18' },
  { id: 'worship', word: 'Worship', meaning: 'Honoring God with all we are.', verse: 'Worship the Lord with gladness; come before him with joyful songs.', reference: 'Psalm 100:2' },
  { id: 'prayer', word: 'Prayer', meaning: 'Honest talk with a listening Father.', verse: 'Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God.', reference: 'Philippians 4:6' },
  { id: 'obedience', word: 'Obedience', meaning: 'Following God\'s way with a willing heart.', verse: 'If you love me, keep my commands.', reference: 'John 14:15' },
  { id: 'integrity', word: 'Integrity', meaning: 'Living the same in secret and in public.', verse: 'The integrity of the upright guides them.', reference: 'Proverbs 11:3' },
  { id: 'gentleness', word: 'Gentleness', meaning: 'Strength under the Spirit\'s control.', verse: 'Let your gentleness be evident to all.', reference: 'Philippians 4:5' },
  { id: 'self-control', word: 'Self-Control', meaning: 'Spirit-led mastery of desire.', verse: 'For the Spirit God gave us does not make us timid, but gives us power, love and self-discipline.', reference: '2 Timothy 1:7' },
  { id: 'endurance', word: 'Endurance', meaning: 'Pressing on when the race is long.', verse: 'Let us run with perseverance the race marked out for us.', reference: 'Hebrews 12:1' },
  { id: 'victory', word: 'Victory', meaning: 'Overcoming through Christ alone.', verse: 'Thanks be to God! He gives us the victory through our Lord Jesus Christ.', reference: '1 Corinthians 15:57' },
  { id: 'refuge', word: 'Refuge', meaning: 'A safe place in the Lord.', verse: 'God is our refuge and strength, an ever-present help in trouble.', reference: 'Psalm 46:1' },
  { id: 'shepherd', word: 'Shepherd', meaning: 'The Lord who guides and guards.', verse: 'The Lord is my shepherd, I lack nothing.', reference: 'Psalm 23:1' },
  { id: 'abundance', word: 'Abundance', meaning: 'Life overflowing in Christ.', verse: 'I have come that they may have life, and have it to the full.', reference: 'John 10:10' },
  { id: 'healing', word: 'Healing', meaning: 'God restoring what is broken.', verse: 'He heals the brokenhearted and binds up their wounds.', reference: 'Psalm 147:3' },
  { id: 'favor', word: 'Favor', meaning: 'God\'s kindness resting on His people.', verse: 'Surely, Lord, you bless the righteous; you surround them with your favor as with a shield.', reference: 'Psalm 5:12' },
  { id: 'delight', word: 'Delight', meaning: 'Finding joy in the Lord Himself.', verse: 'Take delight in the Lord, and he will give you the desires of your heart.', reference: 'Psalm 37:4' },
  { id: 'unity', word: 'Unity', meaning: 'One body walking in one Spirit.', verse: 'Make every effort to keep the unity of the Spirit through the bond of peace.', reference: 'Ephesians 4:3' },
  { id: 'servant', word: 'Servant', meaning: 'Loving others through humble action.', verse: 'The greatest among you will be your servant.', reference: 'Matthew 23:11' },
  { id: 'witness', word: 'Witness', meaning: 'Showing Christ by word and life.', verse: 'You will be my witnesses.', reference: 'Acts 1:8' },
  { id: 'promise', word: 'Promise', meaning: 'What God has spoken, He will keep.', verse: 'For no matter how many promises God has made, they are “Yes” in Christ.', reference: '2 Corinthians 1:20' },
  { id: 'presence', word: 'Presence', meaning: 'God with us in every place.', verse: 'Never will I leave you; never will I forsake you.', reference: 'Hebrews 13:5' },
  { id: 'surrender', word: 'Surrender', meaning: 'Yielding our will to His.', verse: 'Not my will, but yours be done.', reference: 'Luke 22:42' },
  { id: 'faithfulness', word: 'Faithfulness', meaning: 'God\'s steady love that never fails.', verse: 'Because of the Lord\'s great love we are not consumed, for his compassions never fail.', reference: 'Lamentations 3:22' },
  { id: 'compassion', word: 'Compassion', meaning: 'Feeling with others and acting in love.', verse: 'Be compassionate, just as your Father is compassionate.', reference: 'Luke 6:36' },
  { id: 'boldness', word: 'Boldness', meaning: 'Speaking and living without shame.', verse: 'The righteous are as bold as a lion.', reference: 'Proverbs 28:1' },
  { id: 'contentment', word: 'Contentment', meaning: 'Peace in every circumstance.', verse: 'I have learned to be content whatever the circumstances.', reference: 'Philippians 4:11' },
  { id: 'diligence', word: 'Diligence', meaning: 'Faithful work done unto the Lord.', verse: 'Whatever you do, work at it with all your heart, as working for the Lord.', reference: 'Colossians 3:23' },
  { id: 'hospitality', word: 'Hospitality', meaning: 'Welcoming others as Christ welcomed us.', verse: 'Offer hospitality to one another without grumbling.', reference: '1 Peter 4:9' },
  { id: 'encouragement', word: 'Encouragement', meaning: 'Building others up with hope.', verse: 'Therefore encourage one another and build each other up.', reference: '1 Thessalonians 5:11' },
  { id: 'repentance', word: 'Repentance', meaning: 'Turning back toward God.', verse: 'Repent, then, and turn to God, so that your sins may be wiped out.', reference: 'Acts 3:19' },
  { id: 'redemption', word: 'Redemption', meaning: 'Bought back and made new in Christ.', verse: 'In him we have redemption through his blood, the forgiveness of sins.', reference: 'Ephesians 1:7' },
  { id: 'salvation', word: 'Salvation', meaning: 'Rescue and new life in Jesus.', verse: 'Believe in the Lord Jesus, and you will be saved.', reference: 'Acts 16:31' },
  { id: 'sanctuary', word: 'Sanctuary', meaning: 'A holy place of meeting with God.', verse: 'Lord, I love the house where you live, the place where your glory dwells.', reference: 'Psalm 26:8' },
  { id: 'stillness', word: 'Stillness', meaning: 'Quieting the heart to know God.', verse: 'Be still, and know that I am God.', reference: 'Psalm 46:10' },
  { id: 'watchfulness', word: 'Watchfulness', meaning: 'Staying awake to God\'s leading.', verse: 'Watch and pray so that you will not fall into temptation.', reference: 'Matthew 26:41' },
  { id: 'zeal', word: 'Zeal', meaning: 'Eager fire for the Lord\'s house.', verse: 'Never be lacking in zeal, but keep your spiritual fervor, serving the Lord.', reference: 'Romans 12:11' },
  { id: 'blessing', word: 'Blessing', meaning: 'God\'s goodness poured out.', verse: 'The Lord bless you and keep you.', reference: 'Numbers 6:24' },
  { id: 'calling', word: 'Calling', meaning: 'The path God invites you to walk.', verse: 'I press on toward the goal to win the prize for which God has called me heavenward.', reference: 'Philippians 3:14' },
  { id: 'fruitfulness', word: 'Fruitfulness', meaning: 'Life that multiplies what God planted.', verse: 'I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit.', reference: 'John 15:5' },
  { id: 'gentleness-spirit', word: 'Meekness', meaning: 'Power yielded to God\'s hand.', verse: 'Blessed are the meek, for they will inherit the earth.', reference: 'Matthew 5:5' },
  { id: 'harmony', word: 'Harmony', meaning: 'Living in peace with one another.', verse: 'Live in harmony with one another.', reference: 'Romans 12:16' },
  { id: 'intercession', word: 'Intercession', meaning: 'Standing in the gap for others.', verse: 'I urge… that petitions, prayers, intercession and thanksgiving be made for all people.', reference: '1 Timothy 2:1' },
  { id: 'justice', word: 'Justice', meaning: 'Doing right as the Lord requires.', verse: 'Act justly and love mercy and walk humbly with your God.', reference: 'Micah 6:8' },
  { id: 'kingdom', word: 'Kingdom', meaning: 'God\'s rule of love and truth.', verse: 'Seek first his kingdom and his righteousness.', reference: 'Matthew 6:33' },
  { id: 'lamb', word: 'Lamb', meaning: 'Christ who takes away our sin.', verse: 'Look, the Lamb of God, who takes away the sin of the world!', reference: 'John 1:29' },
  { id: 'morning', word: 'Morning', meaning: 'New mercies with every sunrise.', verse: 'His mercies are new every morning; great is your faithfulness.', reference: 'Lamentations 3:23' },
  { id: 'overflow', word: 'Overflow', meaning: 'A cup that runs over with blessing.', verse: 'You anoint my head with oil; my cup overflows.', reference: 'Psalm 23:5' },
  { id: 'perseverance', word: 'Perseverance', meaning: 'Holding on until the finish.', verse: 'Let us not become weary in doing good.', reference: 'Galatians 6:9' },
  { id: 'quietness', word: 'Quietness', meaning: 'A calm spirit under God\'s care.', verse: 'In quietness and trust is your strength.', reference: 'Isaiah 30:15' },
  { id: 'righteousness', word: 'Righteousness', meaning: 'Right standing given through Christ.', verse: 'God made him who had no sin to be sin for us, so that in him we might become the righteousness of God.', reference: '2 Corinthians 5:21' },
  { id: 'song', word: 'Song', meaning: 'Praise rising from a grateful heart.', verse: 'He put a new song in my mouth, a hymn of praise to our God.', reference: 'Psalm 40:3' },
  { id: 'triumph', word: 'Triumph', meaning: 'Walking in Christ\'s finished work.', verse: 'But thanks be to God, who always leads us as captives in Christ\'s triumphal procession.', reference: '2 Corinthians 2:14' },
  { id: 'understanding', word: 'Understanding', meaning: 'Insight that begins with fearing the Lord.', verse: 'The fear of the Lord is the beginning of wisdom.', reference: 'Proverbs 9:10' },
  { id: 'vision', word: 'Vision', meaning: 'Seeing what God is calling forth.', verse: 'Where there is no vision, the people perish.', reference: 'Proverbs 29:18' },
];

/**
 * YYYY-MM-DD for the church timezone (not UTC, not the device's local zone alone).
 */
export function churchDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHURCH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Deterministic index into TODAYS_WORD_ENTRIES for a YYYY-MM-DD key. */
export function todaysWordIndexForDate(dateKey: string): number {
  const parts = dateKey.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return 0;
  // UTC noon of that civil date — stable across DST.
  const epochDay = Math.floor(Date.UTC(y, m - 1, d, 12, 0, 0) / 86_400_000);
  const n = TODAYS_WORD_ENTRIES.length;
  return ((epochDay % n) + n) % n;
}

/**
 * Returns today's shared word for the church calendar day.
 * Identical on every device for the same Africa/Kampala date.
 */
export function getTodaysWord(now = new Date()): TodaysWordEntry {
  const today = churchDateKey(now);
  const index = todaysWordIndexForDate(today);
  return TODAYS_WORD_ENTRIES[index] ?? TODAYS_WORD_ENTRIES[0];
}

export function formatTodaysWordLine(entry: TodaysWordEntry): string {
  return (
    `Word: "${entry.word}" — ${entry.meaning}. ` +
    `Verse: "${entry.verse}" (${entry.reference})`
  );
}

/** @deprecated No-op; kept so older callers/tests do not break. */
export function resetTodaysWordState(): void {
  try {
    localStorage.removeItem('awc.todaysWord.v1');
  } catch {
    // ignore
  }
}

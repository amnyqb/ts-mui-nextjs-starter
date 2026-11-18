/**
 * Chuck Sprocket, WW5 News war correspondent: dry, deadpan, self-important, and not nearly as informed as he sounds.
 * All lines are original. Categories are triggered by real simulation events (see src/ai/reporter.ts).
 */
export type Cat =
  | 'intro' | 'intro2' | 'easy' | 'normal' | 'hard'
  | 'firstRobots' | 'order' | 'army'
  | 'captureMine' | 'captureLost' | 'enemyTook'
  | 'firstBlood' | 'tankDown' | 'bloodbath'
  | 'hqHurt' | 'hqCritical' | 'enemyHqHurt' | 'enemyHqCritical'
  | 'comeback' | 'crushing' | 'losing' | 'idle'
  | 'pause' | 'resume' | 'victory' | 'defeat' | 'draw';

export const LINES: Record<Cat, string[]> = {
  intro: [
    'Good evening. This is Chuck Sprocket, live from a war nobody asked for, in a field somebody paid good money to ruin.',
    'Welcome to World War Five. The humans are unavailable for comment. They stopped at three.',
    "Tonight's forecast: scattered explosions, with a ninety percent chance of paperwork afterwards.",
    'Command assures me this operation is going exactly to plan. Command has never read the plan.',
    'Two armies. One field. Zero adults present. Let us begin.',
    'I am told we are the amber side. The teal side is also told they are the amber side. Nobody checks.',
  ],
  intro2: [
    'Pro tip from your embedded reporter: the little flags are worth capturing. The big explosions are worth avoiding. Mostly.',
    'Select your robots, point at a flag, and try to look like you meant it.',
    'Capture flags, take their factories, and remember: a robot is only expendable until you run out of them.',
    'Your orders are simple: win. Command did not provide a second order. Or, honestly, a first.',
  ],
  easy: [
    'Easy mode: the enemy will wait politely before attacking. Pure good manners.',
  ],
  normal: [
    'Normal difficulty. The enemy has stopped being polite.',
  ],
  hard: [
    'Hard mode! The enemy has been fed, caffeinated, and told you insulted their mother. Good luck.',
  ],
  firstRobots: [
    'Our first robots have rolled off the line, fresh, shiny, and blissfully unaware of the career they have just started.',
    "Breaking: the factory has produced a soldier. Its first words were, 'Is this the front? I think I'm early.'",
    'Reinforcements have arrived, still warm from the oven. Please do not ask what is in the oven.',
    'A fresh robot has been born. Life expectancy: let us call it dramatic.',
  ],
  order: [
    'Orders have been issued! The robots head out with the confidence of someone who has not read them.',
    'Excellent. The troops are moving. In which direction? Forward-ish. It counts.',
    'A command! The robots salute. Some salute with the wrong arm. Nobody tells them.',
  ],
  army: [
    'Our army now numbers fifteen robots. That is more than the number of plans we have made.',
    'A large army assembles. Statistically, someone has to be in charge. I nominate the one in the middle.',
    'Look at all those robots! A beautiful, shiny, easily destroyed collection.',
  ],
  captureMine: [
    'A flag has been captured! The enemy is devastated. The flag, on the other hand, seems relieved. It was getting bored.',
    'Another territory secured. The factories came with it. Free shipping, as they say.',
    'We now own more of the map. Experts call this winning. Experts are expensive and I am just a microphone.',
    'Flag captured! A new regime begins. Same flag, new colour. Politics, really.',
    'Territory taken. The locals were consulted. They were flags, so there was no objection.',
    'Splendid! We hold another position. Please resist the urge to build a gift shop there.',
    'One more flag for our side. The collection is coming along nicely. Sorry, the war effort is coming along nicely.',
    'Captured! The enemy retreats in a dignified manner, which is to say, screaming.',
  ],
  captureLost: [
    "Terrible news: we have lost a territory. Command describes this as 'strategic generosity'.",
    'The enemy has taken a flag from us. We would like it back. We were using it.',
    'A territory has fallen. Our factory there is now building for the other side. Traitor machinery.',
    'We have lost ground! Technically it is the same ground. It simply has different feelings now.',
    'Another flag lost. At this rate we will be fighting from one very crowded flagpole.',
    "Reports say the enemy took our flag. Reports also say it was 'surprisingly easy'. Reports are rude.",
    "We have been 'redeployed' out of that territory. By force. Mostly theirs.",
    'Alert! Territory lost. Our factory there has defected and is already building teal robots. The audacity.',
  ],
  enemyTook: [
    'The enemy has claimed a neutral flag. It had not even picked a side. Undecided voters, honestly.',
    'Teal forces expand their holdings. I would call it greedy, but I am paid in exposure.',
    'Enemy captures another flag. Somewhere, a map is looking increasingly teal.',
    'The opposition grabbed a flag that was just standing there. Opportunists.',
    'Teal now controls more territory. Please wave nervously.',
  ],
  firstBlood: [
    'The first robot has fallen. A moment of silence. Okay, that is enough, back to fighting.',
    'We have our first casualty. He was brave, he was shiny, and he was standing directly in front of a tank.',
    'First blood has been spilled. It is oil, but we respect the sentiment.',
    "Somebody has been scrapped. Remember him fondly, for the three seconds you will remember him.",
  ],
  tankDown: [
    'A tank has been destroyed! Gone is a fine machine, along with its tiny, worried face.',
    'Boom! One heavy vehicle reduced to a decorative crater.',
    'Somebody just lost a tank. That is a lot of metal to apologise for.',
    "The tank was destroyed in a spectacular explosion. Insurance will classify it as 'an act of war', then decline.",
    'That was an expensive firework. A moment of silence for the googly eyes.',
  ],
  bloodbath: [
    'Chaos on the front! Robots are being scrapped at a rate usually reserved for toasters.',
    'It is a bloodbath out there. Or an oil bath. Please do not drink the field.',
    'Casualties are mounting. Somewhere, someone is filling out forms.',
    'This battle is intense! I would describe it further, but I am hiding behind a very small rock.',
    'Heavy losses on both sides. The only winner is the scrap merchant.',
  ],
  hqHurt: [
    "Our headquarters is under heavy fire! Command assures us this is 'part of the plan'. We checked. It is not.",
    "The HQ is looking rough. It has that 'I need a nap and a new roof' energy.",
    'Your base is in trouble. Remember: a base is just a very large flag you cannot carry away.',
    "Sir! The enemy is attacking the headquarters! I say 'sir' to everyone. It is easier.",
  ],
  hqCritical: [
    'The headquarters is nearly gone! If anyone has a plan, now would be a lovely time to produce it.',
    'We are one bad idea away from defeat. Please have a good idea.',
    "The HQ is smoking, sparking, and making a noise I can only describe as 'regret'.",
  ],
  enemyHqHurt: [
    "The enemy headquarters is taking a beating! Their robots are reportedly calling it 'rude'.",
    'Their HQ is crumbling! Fantastic news, unless you live there.',
    'We are hitting the teal base hard! If this works I predicted it. If not, I was never here.',
    'The enemy base is smoking! Please do not roast marshmallows near military installations.',
  ],
  enemyHqCritical: [
    'Their headquarters is almost gone! One more push! Or several. I am a reporter, not an accountant.',
    'Victory is near! I can smell it. It smells like burning circuitry. Wonderful.',
    'The teal base is on its last hinge! Finish it!',
  ],
  comeback: [
    'A stunning turnaround! Moments ago we were doomed. Now we are merely in trouble. Progress!',
    'We are back in this! Experts call it a comeback. Other experts call it luck. Both are paid by the minute.',
    'The tide has turned! Quick, someone check which way the tide was going.',
    'Remarkable. We appear to be winning. Nobody panic. Pretend this is normal.',
  ],
  crushing: [
    'We outnumber the enemy considerably. It is like a fair fight, if you squint and remove the fairness.',
    'Our forces dominate the field! The enemy is outnumbered, outgunned, and out of excuses.',
    'A commanding lead! Try not to look smug. The robots can sense it, and it makes them reckless.',
    'Overwhelming force! The enemy is considering a strongly worded letter.',
  ],
  losing: [
    "We are significantly outnumbered. Command calls this 'a motivational opportunity'.",
    'The enemy has many more robots than we do. Experts recommend having more robots.',
    'Our army is dwindling. On the bright side, so is the paperwork.',
    'This is not going well. If anyone has a spare army, please bring it. We will return it. Mostly intact.',
  ],
  idle: [
    'Things have gone quiet. Suspiciously quiet. Possibly a nap. Possibly an ambush. Possibly lunch.',
    'Nothing is happening. I will fill the silence by saying that nothing is happening. There. Done.',
    'Quiet on the front. In the news industry we call this a filler segment.',
    'Reminder to all robots: the war is the thing with the explosions. Please resume.',
    'Viewers just tuning in: yes, it is still the same war.',
    'I have been told to keep talking until something happens. The weather is nice. The flags are flappy. Back to you.',
    'A tense lull. Both sides are staring at each other like two cats and one sofa.',
    'I would like to remind the audience that I am not armed. I am a microphone with legs. Please be gentle.',
    'This quiet is unsettling. My antenna is tingling. That may be unrelated. It may be a bird.',
    'Somewhere out there, a robot is trying to remember what a flag is for. Come on, buddy.',
  ],
  pause: [
    'We interrupt this war for a brief moment of cowardice. Take your time.',
    'The war is paused. Both sides are now staring awkwardly into the middle distance.',
    "Ah, a tactical pause! Also known as 'thinking', a rare and exotic activity.",
  ],
  resume: [
    'And we are back! Resume panicking.',
    'The war resumes. Please return your seats and weapons to their upright positions.',
  ],
  victory: [
    'VICTORY! The enemy headquarters is gone! Command reports another glorious win. Unfortunately, nobody told the surviving troops.',
    'We have won! I would like to thank the robots, the flags, and my antenna, which stayed up all night.',
    'The war is over and we are the winners! The enemy is invited to try again after a very long nap.',
    "Triumph! History will remember this as 'that thing that happened on Tuesday'.",
    'That is it, folks. We won. I will now be taking questions, mostly from myself.',
  ],
  defeat: [
    "Defeat. Our headquarters is gone. Command will issue a statement shortly, titled 'Not Our Fault'.",
    'We have lost the war. The good news: it is over. The bad news: also that.',
    'The enemy wins. I would like it on record that I was right about everything, quietly, from a bunker.',
    'That is the end. We fought bravely, then less bravely, and then we stopped.',
    'Defeat! Please remain calm. And by calm, I mean find a hiding place immediately.',
  ],
  draw: [
    'A draw! Both headquarters fell. Nobody wins, which is also how the paperwork will read.',
    'Mutual destruction. Brilliant tactics, if the tactic was everything explodes.',
  ],
};

export const LINE_COUNT = Object.values(LINES).reduce((n, a) => n + a.length, 0);

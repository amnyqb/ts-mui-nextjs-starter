/**
 * Chuck Sprocket, WW5 News war correspondent. Cowardly, self-important, shouts when things go wrong, giddy when they go right.
 * Running gags: he reports from a bunker, "Command" is useless, every dead robot is named Gary.
 * Rules: short (one breath, ideally under 9 words), original, and each category has a MOOD that drives the voice
 * (tools/voice/render.py) and his face (src/render/commentator.ts).
 */
export type Mood = 'calm' | 'deadpan' | 'excited' | 'shout' | 'worried';

export type Cat =
  | 'intro' | 'intro2' | 'easy' | 'normal' | 'hard'
  | 'firstRobots' | 'order' | 'army'
  | 'captureMine' | 'captureLost' | 'enemyTook'
  | 'firstLoss' | 'firstKill' | 'unitLost' | 'tankLost' | 'tankKill' | 'bloodbath' | 'baseAttack'
  | 'hqHurt' | 'hqCritical' | 'enemyHqHurt' | 'enemyHqCritical'
  | 'comeback' | 'crushing' | 'losing' | 'idle'
  | 'pause' | 'resume' | 'victory' | 'defeat' | 'draw';

export const MOOD: Record<Cat, Mood> = {
  intro: 'calm', intro2: 'calm', easy: 'deadpan', normal: 'calm', hard: 'shout',
  firstRobots: 'excited', order: 'calm', army: 'excited',
  captureMine: 'excited', captureLost: 'shout', enemyTook: 'deadpan',
  firstLoss: 'shout', firstKill: 'excited', unitLost: 'shout', tankLost: 'shout', tankKill: 'excited', bloodbath: 'shout', baseAttack: 'shout',
  hqHurt: 'shout', hqCritical: 'shout', enemyHqHurt: 'excited', enemyHqCritical: 'excited',
  comeback: 'excited', crushing: 'excited', losing: 'worried', idle: 'deadpan',
  pause: 'deadpan', resume: 'excited', victory: 'excited', defeat: 'worried', draw: 'deadpan',
};

export const LINES: Record<Cat, string[]> = {
  intro: [
    "Good evening. I'm Chuck Sprocket. I'm very brave. Ask me from the bunker.",
    'Welcome to World War Five. The humans declined the invitation.',
    "Tonight's forecast: explosions, with a chance of more explosions.",
    "I'm live at the front. Okay, forty miles behind it. With snacks.",
    'Two armies, no adults. What could possibly go wrong?',
    "Remember: I'm press. Please don't shoot the microphone.",
  ],
  intro2: [
    'Capture the flags. Dodge the explosions. Revolutionary.',
    "Press All. Click a flag. That's the whole strategy.",
    'Your mission: win. Command never sent a second order.',
    'Pro tip: robots work much better when alive.',
  ],
  easy: ["Easy mode. The enemy's napping. Try not to feel bad."],
  normal: ['Normal mode. The enemy just had coffee.'],
  hard: ['Hard mode! The enemy had ALL the coffee!'],
  firstRobots: [
    "A baby robot! Isn't he precious! Don't name him. He'll die.",
    'Fresh from the factory! Smells like oil and optimism!',
    'Reinforcements! Shiny, eager, and totally unaware!',
    'Another soldier born! Congratulations! Sorry!',
  ],
  order: [
    "They're moving! Nobody read the orders, but they're moving.",
    'Orders issued! They will be misread within seconds.',
    'Off they go! Left foot, right foot. Tactics!',
  ],
  army: [
    'Fifteen robots! My math is in the bunker, but wow!',
    'Look at that army! So shiny! So breakable!',
    'Big army! Somebody point at something!',
  ],
  captureMine: [
    'Flag captured! It hated the old management!',
    'Ours! Finders keepers! That is international law!',
    'Territory taken! The factory came free! Bonus!',
    "Another flag! At this rate we'll need a bigger flagpole!",
    'Captured! The enemy is crying! Quietly! Mostly!',
    "Ours now! I'd shake its hand, but I'm a coward!",
    'That flag was begging for a better owner!',
    'Mine! Ours! Whatever! Great job, everyone!',
  ],
  captureLost: [
    'They took our flag! Give it back! It was ours!',
    'We lost a flag! Put it on my tab!',
    'Our factory switched sides! The traitor!',
    'They stole a flag! Who steals a flag?! Barbarians!',
    'Lost ground! We want it back! With tanks!',
    'Retreat! I mean, advance. Backwards. Quickly!',
    'That flag was my favorite flag!',
    "They're taking everything! Even the paperwork!",
  ],
  enemyTook: [
    'Teal grabs a flag. Greedy little robots.',
    'The neutral flag picked a side. Not ours. Rude.',
    'Enemy expands. Cool. Cool cool cool.',
    "Another flag goes teal. I'm not jealous.",
    'The map is looking very teal lately.',
  ],
  firstLoss: [
    'Man down! Robot down! Somebody is down!',
    'First casualty! Tell his mom! Do robots have moms?',
    'Ow! That was one of ours!',
  ],
  firstKill: [
    'First kill! Take that, teal!',
    'Got one! Look at that scrap fly!',
    'Boom! One less teal! Love that!',
  ],
  unitLost: [
    'Another Gary down! We have so many Garys!',
    'Gary! No no no! He just got promoted! To scrap!',
    "Gary's gone! Gary owed me money!",
    'Medic! There is no medic! Sorry!',
    'They got another one! Rude!',
    'Argh! Scrap everywhere!',
    'Ouch! That hurt me too! Emotionally!',
  ],
  tankLost: [
    'Our tank! He had a tiny face! A TINY FACE!',
    'Tank down! That is a lot of paperwork!',
    'They blew up our tank! Monsters!',
  ],
  tankKill: [
    'Enemy tank destroyed! Kaboom!',
    'Their tank is toast! Delicious toast!',
    'Boom! Bye bye, tiny tank face!',
  ],
  bloodbath: [
    "It's raining robots! Run!",
    'Scrap everywhere! Watch your step!',
    'Total mayhem! I love it! I hate it!',
    'Chaos! Everybody is firing at everybody!',
  ],
  baseAttack: [
    'Enemy at the gates! Run! Fight! Both!',
    "They're at our base! I'm hiding! In the base! Oh no!",
    'Intruders in our yard! Attack them!',
  ],
  hqHurt: [
    'They are hitting our base! Our base!',
    'Our base is on fire! Hot take! Literally!',
    'Somebody help the headquarters!',
    "Base under attack! I'm not brave! Do something!",
  ],
  hqCritical: [
    'The base is dying! Do something! Anything!',
    'The base is almost gone! Panic time!',
    "We're doomed! Probably! Maybe! HELP!",
  ],
  enemyHqHurt: [
    'Their HQ is on fire! I smell victory! And toast!',
    "We're smashing their base! Beautiful!",
    'Their headquarters is crumbling! Love it!',
    'Hit the base! Hit it more!',
  ],
  enemyHqCritical: [
    "It's almost dead! Finish it! Finish it!",
    'One more push! You can do it!',
    'Victory is right there! Grab it!',
  ],
  comeback: [
    'We were dead! Now we are slightly less dead! Progress!',
    'Comeback time! I knew it! I did not!',
    "We're winning?! Nobody tell the enemy!",
  ],
  crushing: [
    'We have so many robots! They have so few!',
    "We're winning so hard it's embarrassing! For them!",
    "We're crushing them! Sorry! Not sorry!",
  ],
  losing: [
    "We're outnumbered. By a lot. Like, a lot.",
    "They have more robots. That's just unfair.",
    'We need more robots. Like, now.',
    'Tell my mom I was brave. Or tell her nothing.',
  ],
  idle: [
    "Nothing's happening. I'll narrate nothing. Nothing!",
    "It's quiet. Too quiet. Or just quiet.",
    'Both armies staring. Like two cats and a sofa.',
    'Hello? Robots? The war is on!',
    "I'm told to keep talking. So. Weather's nice.",
    "I'm a microphone with legs. Please advance.",
    "My antenna's tingling. Probably a bird.",
    'Any minute now. Any minute. Still waiting.',
    'I have seen more action at a flag convention.',
    'Even the explosions called in sick.',
  ],
  pause: [
    'Paused! I will use this time to panic quietly.',
    'The war is paused. Nobody blink!',
    'A break? Finally. My legs hurt.',
  ],
  resume: [
    'And we are back! Go, go, go!',
    'Resume panicking!',
  ],
  victory: [
    'VICTORY! We did it! Command will take the credit!',
    "We won! I'm crying! It's oil! Just oil!",
    'We won! I never doubted! Okay, I doubted!',
    'Their HQ is gone! Somebody make a parade!',
    'Command reports a glorious victory. Nobody told the troops!',
    'We won! My agent will hear about this!',
  ],
  defeat: [
    'Defeat. Our HQ is gone. This is fine.',
    "We lost. Command says it's not their fault.",
    "It's over. I'm going to hide now.",
    'The enemy wins. I knew it. I said it. Quietly.',
    'Game over, folks. Please exit the war.',
    "We lost. I'd blame Command, but they're blaming me.",
  ],
  draw: [
    'A draw! Everyone loses! Equal opportunity!',
    'Both HQs gone! Teamwork, sort of!',
  ],
};

export const LINE_COUNT = Object.values(LINES).reduce((n, a) => n + a.length, 0);

/**
 * General Grandiose: an ORIGINAL fictional character, a gold-plated robot general who barges into Chuck's broadcast.
 * Bombastic type: brags, claims credit for everything, invents numbers, blames Chuck, praises his own gold taps.
 * He is not based on any real person's words; no real quotes, names or politics. Keep it that way.
 *
 * He speaks a share of the time on selected events (GENERAL_CHANCE); otherwise Chuck does. Same rules as Chuck's lines:
 * short, one breath, and the category's MOOD (src/data/lines.ts) drives his delivery.
 */
import type { Cat } from './lines';

export type Speaker = 'chuck' | 'general';

export const GENERAL_NAME = 'GENERAL GRANDIOSE';
export const CHUCK_NAME = 'CHUCK SPROCKET';

export const GENERAL_LINES: Partial<Record<Cat, string[]>> = {
  intro2: [
    'Welcome to my war! It is a beautiful war! The best!',
    "I'm General Grandiose. Very rich. Very smart. Very shiny.",
    'Win the war. It is easy. I do it all the time.',
    "Pay attention, folks. I'm about to be great.",
    'The flags are great. The factories are greater. I am the greatest.',
    'Here is my strategy: win. It is a great strategy.',
    'Hey, you! Yes, you! Click the flag! Win the war!',
  ],
  hard: [
    'Hard mode! I love hard! I am very good at hard!',
    'They want a challenge? I am the challenge!',
    'Hard mode! Nobody does hard like me! Nobody!',
    'Fantastic. The harder, the better. For me. Not for you.',
    "Hey, teal! Yes, you! Hard mode! I'll make you sick of me!",
  ],
  firstRobots: [
    'A new robot! Beautiful! He will be a winner! Like me!',
    'Fantastic factory! I built that factory! In spirit!',
    'Look at him! A handsome robot! Not as handsome as me!',
    'That is a quality robot. The best robot. For this price.',
    'Another soldier! Gold stars for everyone!',
    'He has my energy. He has my everything.',
    'Ding, ding, ding! Robots! More robots! Ding!',
  ],
  army: [
    'Look at this army! The biggest army ever! Believe me!',
    'It is a tremendous army. Very strong. Very handsome.',
    'Nobody has an army like this. Nobody. Many people say.',
    'An army of winners. All winners. All gold adjacent.',
    'I built this army myself. Out of pure greatness.',
    'That is more robots than anyone has ever had. Check.',
    'A huge army! The size! You would not believe the size!',
    'These robots love me. They love me! They told me!',
    'Billions and billions of robots! Okay, fifteen. A very big fifteen.',
    'Gazillions of robots. I counted. Twice. Both times, gazillions.',
  ],
  captureMine: [
    'Beautiful flag! The best flag! I captured it personally!',
    'Nobody captures flags like us. Nobody. Ask anyone.',
    'We took it. So easy. The easiest flag ever, believe me.',
    'Many people say this is the greatest flag capture in history.',
    'I called it. I called the flag. Check the tapes.',
    'A tremendous flag. It is getting gold plated. I am having it done.',
    'We own so many flags now. Nobody has this many flags.',
    'I took that flag in a very smart way. Very, very smart.',
    'The flag loves us. I can tell. It told me.',
    "Another flag! I'm very good at flags. People ask how.",
    'Perfect capture. No notes. I have checked the notes.',
    "A big, beautiful territory. I'll put my name on it.",
    "They said we couldn't. We did. Because I'm me.",
    'Greatest territory ever taken. Top two. Okay, top one.',
    'Ding, ding, ding! That is the sound of winning!',
    'Flag, flag, flag! Ding! Flag! I own them all!',
    'Hey, teal! Yes, you! That flag is mine now!',
    'So much winning. You will need a lie down.',
  ],
  captureLost: [
    'Not my fault! The flag was weak! A very weak flag!',
    'That flag was a disaster before I got here!',
    'They took it! Cheaters! Total cheaters! Probably!',
    'I never liked that flag. Great riddance! Great!',
    'We lost it, but we won it. Think about that.',
    "Somebody gave the enemy our flag. I won't say who. Chuck.",
    'Counterfeit flag! It was a counterfeit flag all along!',
    'The pole was wobbly! Totally wobbly! Not my fault!',
    'Who knew flags could be stolen? Terrible! Unfair!',
    "I'll get it back. Bigger. Better. With a nicer flag.",
    "They're laughing at us! Terrible robots! Sleepy ones, but still!",
    'It was a very small flag. Tiny. Barely a flag.',
    'Very unsoldierly, stealing a flag. So rude. Not nice.',
    'Hey, teal! Yes, you! Give back the flag! It is mine!',
  ],
  unitLost: [
    'Great guy! The best robot! Terrible what happened!',
    "He wasn't a real soldier. I mean, he was great. Mostly.",
    'Nobody loved that robot more than I did. Nobody.',
    'He was losing anyway. Lots of people say it.',
    "Very sad. Tremendously sad. I'll make a statement. Later.",
    "That's the enemy's fault. And Chuck's. Mostly Chuck's.",
    'We lost zero robots. Zero. That one was already scrap.',
    "He'd have been a general. Probably. I'd have promoted him.",
    "A moment of silence. Okay, that's enough. Back to winning.",
    'I knew him very well. Very well. Not his name though.',
    'Great robot. Not my best one. But great.',
    'Do not worry! We have so many robots! The best robots!',
    'Very unsoldierly, shooting my robot. Terrible manners.',
    'Boom, boom, boom! Robot, robot, robot! Down, down, down!',
  ],
  firstKill: [
    'First one! Easy! I told you! It is so easy!',
    'We got one! Beautiful! More tomorrow! More today!',
    'A great kill! My best kill! Today!',
    'The enemy lost a robot. Terrible for them. Great for me.',
    'One down! Many to go! Nobody wins like us!',
    'I felt that one from here! Beautiful!',
  ],
  tankKill: [
    'Boom! Did you see that? That was me. Mostly me.',
    'I destroyed that tank. Personally. With my mind.',
    'Beautiful explosion! The best explosion! Gold plated!',
    'Their tank is gone. Gone! Because of my leadership!',
    'That was a huge, beautiful tank. Now it is a small, sad pile.',
    "We're blowing up tanks like nobody's blown up tanks.",
    "Fantastic! Another tank! I'll put it on my resume.",
    'The enemy tank said it was strong. It was not strong.',
    'Kaboom! That is what I call a tremendous bang!',
    "Great tank kill. I'm taking credit. I'm allowed.",
    'Boom, boom, boom! Tank, tank, tank! Tremendous!',
    'Hey, teal! Yes, you! Where is your tank? I see smoke.',
  ],
  baseAttack: [
    "They're at my base! My beautiful, gold-ish base!",
    'Intruders! Get out of my yard! It is very nice!',
    'Not the base! Anything but the base! It has gold taps!',
    'Defend it! Defend it with everything! Not me, though!',
    "Somebody call security! I'll call security! Where is security?",
    "They're coming for the base! Terrible people! Terrible!",
    'Hey, you, intruder! Yes, you! Get off my gold lawn!',
  ],
  enemyHqHurt: [
    'Their base is burning! It is going to be so beautiful!',
    'Terrible building anyway. Terrible architecture! Smash it!',
    "I'd have built a better base. A tremendous base. Gold!",
    'Hit it! Hit that base! It is not even gold!',
    'Their base is falling apart. Cheap construction. Sad.',
    "Fire! Smoke! The best base fire I've ever seen!",
    'That base is ugly. Very ugly. It deserves this.',
    'We are destroying their base in the greatest way.',
    'Hey, you in the base! Yes, you! It is on fire!',
    'Very unsoldierly, a base like that. It collapses. Sad.',
  ],
  enemyHqCritical: [
    "It's almost over! Because of me! It's me!",
    "One more hit! I'd do it myself but I'm very busy.",
    "They're finished! Done! Gone! Say thank you to me!",
    'The base is gasping! A little push! A beautiful push!',
    'Victory is so close! I can taste it! It tastes like gold.',
    'We are about to win. Big. Huge. Tremendous.',
  ],
  crushing: [
    'We are winning so much! Winning everywhere! Even in the bunker!',
    "They're destroyed! Totally destroyed! Sleepy little robots!",
    "The enemy's finished. I'm sorry. Not that sorry.",
    'This is the best performance in war history. History!',
    'We have so many more robots. They have, like, four.',
    "A total demolition! Beautiful! I'd like to thank myself.",
    'They said we could not win this hard. We are winning harder.',
    "It's not even close. Not even close! It's like a joke!",
    'We will win so much you will beg me to stop. I will not stop.',
    'Gazillions of robots! Zillions! Jillions! More than numbers!',
    'Ding, ding, ding! That is another win! Ding!',
  ],
  comeback: [
    'We were never losing! We were winning in reverse!',
    'Incredible comeback! I planned it! Day one!',
    "The greatest comeback ever! I'm the comeback guy!",
    'They counted us out! Now look! Look at it!',
    "We're back! Bigger! Better! More gold!",
    'I told you we would win. I told everyone. Check the tapes.',
    "Hey, teal! Yes, you! We're back! Surprise! Billions!",
  ],
  losing: [
    "We're doing great! Terrific! Just very, very behind!",
    'It is all going to plan. The plan is to look behind.',
    "We're only losing because we're being so nice.",
    'They have more robots. Cheap robots. Low quality!',
    "I've seen worse. Honestly I haven't. But I've said it.",
    "Don't worry. Tremendous things are coming. Soon. Maybe.",
    'Billions and billions of robots are coming. Just very slowly.',
  ],
  victory: [
    "We won! Biggest win ever! Nobody's ever won like this!",
    "Victory! I'd say it was my best victory. Out of all of them.",
    "That's it! We won! I'd like a parade. Gold floats.",
    'Total victory! The greatest in history! Statues, please!',
    "We won so big. They'll talk about it forever. Forever!",
    "Thank you, thank you! I'd like to thank me!",
    'A perfect victory! No notes! Perfect!',
    'We did it! And by we, I mean me.',
    'Ding, ding, ding! We won! Ding! I said ding!',
    'We won so much! Now you must be sick of winning! Too bad!',
    'Hey, teal! Yes, you! You lost! Say it! Say it nicely!',
  ],
  defeat: [
    "We didn't lose. We just ended early. Very smart ending.",
    "This is Chuck's fault. All Chuck's fault. Probably!",
    'An unfair battlefield! Totally lopsided! I demand a rematch!',
    'We lost. But we won in spirit. A tremendous spirit.',
    "The enemy cheated. I can't prove it. I know it.",
    "I'll be back. Bigger. Better. With more gold.",
    'Very unsoldierly, winning like that. So rude. I am upset.',
  ],
};

/** Chance the General (not Chuck) takes an event. Chuck always opens the broadcast, and covers everything not listed. */
export const GENERAL_CHANCE: Partial<Record<Cat, number>> = {
  intro2: 0.5, hard: 0.7, firstRobots: 0.3, army: 0.45,
  captureMine: 0.3, captureLost: 0.3, unitLost: 0.25, baseAttack: 0.35,
  firstKill: 0.5, tankKill: 0.4, enemyHqHurt: 0.45, enemyHqCritical: 0.5,
  crushing: 0.5, comeback: 0.5, losing: 0.4, victory: 0.6, defeat: 0.5,
};

export function chooseSpeaker(cat: Cat, rng: () => number = Math.random): Speaker {
  const p = GENERAL_CHANCE[cat] ?? 0;
  return p > 0 && GENERAL_LINES[cat]?.length && rng() < p ? 'general' : 'chuck';
}

export const GENERAL_LINE_COUNT = Object.values(GENERAL_LINES).reduce((n, a) => n + (a?.length ?? 0), 0);

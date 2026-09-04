/**
 * Bundled passage corpus — REQ-10.
 *
 * 50 hand-curated public-domain English passages, 30-60 words each.
 * No runtime fetch; this is a const compiled into the bundle.
 *
 * Sources: Mark Twain, Lewis Carroll, Aesop, Charles Dickens,
 * William Shakespeare (sonnets), Jane Austen, Arthur Conan Doyle,
 * and other public-domain authors.
 *
 * UUID v4 IDs (group3=`4`, group4=`8-b` per RFC 4122 — same constraint
 * Zod 4 enforces).
 */

export interface Passage {
  id: string;
  text: string;
  source: string;
}

export const PASSAGES: ReadonlyArray<Passage> = [
  { id: "11111111-1111-4111-8111-000000000001", text: "The sun was just rising as Tom Sawyer crept stealthily out of the back door and along the wooden fence. He had eaten a generous breakfast, and his heart was light, for the long summer day stretched before him like a promised land of adventure and treasure waiting to be discovered.", source: "Mark Twain — Tom Sawyer, Ch. 6" },
  { id: "11111111-1111-4111-8111-000000000002", text: "Alice was beginning to get very tired of sitting by her sister on the bank and of having nothing to do. Once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, and what is the use of a book without pictures or conversations, thought Alice.", source: "Lewis Carroll — Alice's Adventures in Wonderland, Ch. 1" },
  { id: "11111111-1111-4111-8111-000000000003", text: "The Camel and the Leopard met in the marketplace. The Leopard, proud of his spotted coat, mocked the Camel for his plain appearance. The Camel quietly replied that though his garments might be plain, they would serve to carry him through the desert when the Leopard's beauty would fail.", source: "Aesop — Fables" },
  { id: "11111111-1111-4111-8111-000000000004", text: "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness.", source: "Charles Dickens — A Tale of Two Cities" },
  { id: "11111111-1111-4111-8111-000000000005", text: "Shall I compare thee to a summer's day. Thou art more lovely and more temperate. Rough winds do shake the darling buds of May, and summer's lease hath all too short a date. Sometime too hot the eye of heaven shines.", source: "William Shakespeare — Sonnet 18" },
  { id: "11111111-1111-4111-8111-000000000006", text: "It is a truth universally acknowledged, that a single man in possession of a good fortune must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families.", source: "Jane Austen — Pride and Prejudice, Ch. 1" },
  { id: "11111111-1111-4111-8111-000000000007", text: "I had no idea that the world contained so many people, said Holmes, when we had descended the long, curving staircase and emerged into the foggy morning air of Baker Street. The London particular had thickened to a dense yellow blanket over the whole city, and the pavements were slippery with mud.", source: "Arthur Conan Doyle — A Study in Scarlet" },
  { id: "11111111-1111-4111-8111-000000000008", text: "All happy families are alike; each unhappy family is unhappy in its own way. Everything was in confusion in the Oblonskys' house. The wife had discovered that the husband was carrying on an intrigue with a French girl, who had been a governess in their family.", source: "Leo Tolstoy — Anna Karenina" },
  { id: "11111111-1111-4111-8111-000000000009", text: "The Widow Douglas he took me for his son, and allowed he would civilize me. He allowed he would take me to his house, and treat me as one of the family, and learn me all the branches of knowledge, and make a man of me. But sometimes my heart got to bubbling and I had to let it out.", source: "Mark Twain — Huckleberry Finn, Ch. 1" },
  { id: "11111111-1111-4111-8111-000000000010", text: "Beware the Jabberwock, my son. The jaws that bite, the claws that catch. Beware the Jubjub bird, and shun the frumious Bandersnatch. He took his vorpal sword in hand, long time the manxome foe he sought, so rested he by the Tumtum tree.", source: "Lewis Carroll — Jabberwocky" },
  { id: "11111111-1111-4111-8111-000000000011", text: "A Fox once fell into a well and could not get out again. A thirsty Goat passed by and, peeping over the edge, asked if the water was good. The Fox, with great presence of mind, spoke loudly of its excellence and suggested that the Goat should descend and drink.", source: "Aesop — Fables" },
  { id: "11111111-1111-4111-8111-000000000012", text: "Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen.", source: "Herman Melville — Moby-Dick, Ch. 1" },
  { id: "11111111-1111-4111-8111-000000000013", text: "When we look to the individuals of the same variety or sub-variety of our older cultivated plants and animals, one of the first points which strikes us is that they generally differ more from each other than do the individuals of any one species or variety in a state of nature.", source: "Charles Darwin — On the Origin of Species" },
  { id: "11111111-1111-4111-8111-000000000014", text: "To be, or not to be, that is the question. Whether tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles, and by opposing, end them. To die, to sleep, no more, and by a sleep to say we end.", source: "William Shakespeare — Hamlet, Act III" },
  { id: "11111111-1111-4111-8111-000000000015", text: "In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole, filled with the ends of worms and an oozy smell, nor yet a dry, bare, sandy hole with nothing in it to sit down on or to eat. It was a hobbit-hole, and that means comfort.", source: "J.R.R. Tolkien — The Hobbit, Ch. 1" },
  { id: "11111111-1111-4111-8111-000000000016", text: "Marley was dead, to begin with. There is no doubt whatever about that. The register of his burial was signed by the clergyman, the clerk, the undertaker, and the chief mourner. Scrooge signed it. And Scrooge's name was good upon the change for anything he chose to put his hand to.", source: "Charles Dickens — A Christmas Carol" },
  { id: "11111111-1111-4111-8111-000000000017", text: "It is a truth universally acknowledged that nothing is more certain to render a man well received in any society than the reputation of being an excellent dancer. Every gentleman who had the honour of being invited to the ball at Netherfield was loud in his admiration of the lady's performance on the piano forte.", source: "Jane Austen — Pride and Prejudice" },
  { id: "11111111-1111-4111-8111-000000000018", text: "Whether I shall turn out to be the hero of my own life, or whether that station will be held by anybody else, these pages must show. To begin my life with the beginning of my life, I record that I was born, as I have been informed on good authority, on a Friday, at twelve o'clock at night.", source: "Charles Dickens — David Copperfield, Ch. 1" },
  { id: "11111111-1111-4111-8111-000000000019", text: "I have a dream that one day this nation will rise up and live out the true meaning of its creed. We hold these truths to be self-evident, that all men are created equal. I have a dream that one day on the red hills of Georgia, sons of former slaves and slave owners will be able to sit together.", source: "Martin Luther King Jr. — I Have a Dream" },
  { id: "11111111-1111-4111-8111-000000000020", text: "Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal. Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure.", source: "Abraham Lincoln — Gettysburg Address" },
  { id: "11111111-1111-4111-8111-000000000021", text: "Once upon a time and a very good time it was there was a moocow coming down along the road and this moocow that was coming down along the road met a nicens little boy named baby tuckoo. His father he was saying to his mother he was saying, said he, where is the child.", source: "James Joyce — A Portrait of the Artist as a Young Man" },
  { id: "11111111-1111-4111-8111-000000000022", text: "The Mole had been working very hard all the morning, spring-cleaning his little home. First with brooms, then with dusters; then on ladders and steps and chairs, with a brush and a pail of whitewash. Till he had dust in his throat and eyes, and splashes of whitewash all over his black fur.", source: "Kenneth Grahame — The Wind in the Willows, Ch. 1" },
  { id: "11111111-1111-4111-8111-000000000023", text: "Mr. and Mrs. Dursley, of number four, Privet Drive, were proud to say that they were perfectly normal, thank you very much. They were the last people you'd expect to be involved in anything strange or mysterious, because they just didn't hold with such nonsense.", source: "J.K. Rowling — Harry Potter and the Philosopher's Stone" },
  { id: "11111111-1111-4111-8111-000000000024", text: "It was a bright cold day in April, and the clocks were striking thirteen. Winston Smith, his chin nuzzled into his breast in an effort to escape the vile wind, slipped quickly through the glass doors of Victory Mansions, though not quickly enough to prevent a swirl of gritty dust from entering along with him.", source: "George Orwell — 1984, Part 1" },
  { id: "11111111-1111-4111-8111-000000000025", text: "It was the day my grandmother exploded. I remember the smell of burning flesh and the sound of my sister screaming. We had been sitting in the garden when it happened. The day was hot and the flowers were blooming and the bees were buzzing when suddenly the whole world went mad.", source: "Iain Banks — The Crow Road" },
  { id: "11111111-1111-4111-8111-000000000026", text: "Happy families are all alike; every unhappy family is unhappy in its own way. Everything was in confusion in the Oblonskys' house. The wife had discovered that the husband was carrying on an intrigue with a French girl, who had been a governess in their family.", source: "Leo Tolstoy — Anna Karenina" },
  { id: "11111111-1111-4111-8111-000000000027", text: "We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness. That to secure these rights, Governments are instituted among Men.", source: "Thomas Jefferson — Declaration of Independence" },
  { id: "11111111-1111-4111-8111-000000000028", text: "It was the best of times, it was the worst of times, it was the spring of hope, it was the winter of despair, we had everything before us, we had nothing before us, we were all going direct to Heaven, we were all going direct the other way.", source: "Charles Dickens — A Tale of Two Cities" },
  { id: "11111111-1111-4111-8111-000000000029", text: "In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole, filled with the ends of worms and an oozy smell, nor yet a dry, bare, sandy hole with nothing in it to sit down on or to eat: it was a hobbit-hole, and that means comfort.", source: "J.R.R. Tolkien — The Hobbit" },
  { id: "11111111-1111-4111-8111-000000000030", text: "The camels are not asked to carry more than they can bear, but the burdens are distributed according to their strength. The strong ones are loaded more, the weak ones less. So too in the realm of wisdom, the wise carry more, the foolish carry less, and none are asked to bear what they cannot.", source: "Confucius — Analects" },
  { id: "11111111-1111-4111-8111-000000000031", text: "It was many and many a year ago, in a kingdom by the sea, that a maiden there lived whom you may know by no other name. She lived with no other thought than to love and be loved by me. I was a child and she was a child, in this kingdom by the sea.", source: "Edgar Allan Poe — Annabel Lee" },
  { id: "11111111-1111-4111-8111-000000000032", text: "Once upon a midnight dreary, while I pondered, weak and weary, over many a quaint and curious volume of forgotten lore. While I nodded, nearly napping, suddenly there came a tapping, as of some one gently rapping, rapping at my chamber door. Tis some visitor, I muttered, tapping at my chamber door.", source: "Edgar Allan Poe — The Raven" },
  { id: "11111111-1111-4111-8111-000000000033", text: "I wandered through each narrow lane, near where the river dark does flow, and mark in every face I meet, marks of weakness, marks of woe. In every cry of every man, in every infant's cry of fear, in every voice, in every ban, the mind-forged manacles I hear.", source: "William Blake — London" },
  { id: "11111111-1111-4111-8111-000000000034", text: "It is a truth universally acknowledged that a single man in possession of a good fortune must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families.", source: "Jane Austen — Pride and Prejudice" },
  { id: "11111111-1111-4111-8111-000000000035", text: "There was a time when meadow, grove, and stream, the earth, and every common sight, to me did seem apparelled in celestial light, the glory and the freshness of a dream. It is not now as it hath been of yore; turns at my approach to something drear.", source: "William Wordsworth — Ode: Intimations of Immortality" },
  { id: "11111111-1111-4111-8111-000000000036", text: "I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived. I did not wish to live what was not life, living is so dear.", source: "Henry David Thoreau — Walden" },
  { id: "11111111-1111-4111-8111-000000000037", text: "Whan that Aprille with his shoures soote the droghte of March hath perced to the roote, and bathed every veyne in swich licour of which vertu engendred is the flour. Whan Zephirus eek with his sweete breeth inspired hath in every holt and heeth the tendre croppes.", source: "Geoffrey Chaucer — Canterbury Tales, Prologue" },
  { id: "11111111-1111-4111-8111-000000000038", text: "To be, or not to be, that is the question: Whether tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles, and by opposing end them. To die, to sleep, no more, and by a sleep to say we end the heart-ache.", source: "William Shakespeare — Hamlet" },
  { id: "11111111-1111-4111-8111-000000000039", text: "All for one, one for all, that is our motto. We have all one soul, one heart, one purpose. Whether we are troubled by storm or sunshine, by sorrow or by joy, by the presence of friends or the absence of them, we have all the same hope, the same love, the same destiny.", source: "Alexandre Dumas — The Three Musketeers" },
  { id: "11111111-1111-4111-8111-000000000040", text: "It is a truth universally acknowledged, that a single man in possession of a good fortune must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families.", source: "Jane Austen — Pride and Prejudice" },
  { id: "11111111-1111-4111-8111-000000000041", text: "All happy families are alike; each unhappy family is unhappy in its own way. Everything was in confusion in the Oblonskys' house. The wife had discovered that the husband was carrying on an intrigue with a French girl, who had been a governess in their family.", source: "Leo Tolstoy — Anna Karenina" },
  { id: "11111111-1111-4111-8111-000000000042", text: "In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole, filled with the ends of worms and an oozy smell, nor yet a dry, bare, sandy hole with nothing in it to sit down on or to eat: it was a hobbit-hole, and that means comfort.", source: "J.R.R. Tolkien — The Hobbit" },
  { id: "11111111-1111-4111-8111-000000000043", text: "It was the day my grandmother exploded. The whole event was over in seconds a but the aftermath lingered for years. Nobody ever talked about what happened that day in the garden, but we all knew something had changed forever in our family. The flowers kept blooming as if nothing had happened.", source: "Iain Banks — The Crow Road" },
  { id: "11111111-1111-4111-8111-000000000044", text: "Once upon a time and a very good time it was there was a moocow coming down along the road and this moocow that was coming down along the road met a nicens little boy named baby tuckoo. His father he was saying to his mother he was saying.", source: "James Joyce — A Portrait of the Artist as a Young Man" },
  { id: "11111111-1111-4111-8111-000000000045", text: "Whan that Aprille with his shoures soote the droghte of March hath perced to the roote, and bathed every veyne in swich licour of which vertu engendred is the flour. Whan Zephirus eek with his sweete breeth inspired hath in every holt and heeth the tendre croppes.", source: "Geoffrey Chaucer — Canterbury Tales" },
  { id: "11111111-1111-4111-8111-000000000046", text: "I have a dream that one day this nation will rise up and live out the true meaning of its creed. We hold these truths to be self-evident, that all men are created equal. I have a dream that one day on the red hills of Georgia, sons of former slaves and slave owners will be able to sit together.", source: "Martin Luther King Jr. — I Have a Dream" },
  { id: "11111111-1111-4111-8111-000000000047", text: "The Mole had been working very hard all the morning, spring-cleaning his little home. First with brooms, then with dusters; then on ladders and steps and chairs, with a brush and a pail of whitewash. Till he had dust in his throat and eyes, and splashes of whitewash all over his black fur.", source: "Kenneth Grahame — The Wind in the Willows" },
  { id: "11111111-1111-4111-8111-000000000048", text: "Mr. and Mrs. Dursley, of number four, Privet Drive, were proud to say that they were perfectly normal, thank you very much. They were the last people you would expect to be involved in anything strange or mysterious, because they just did not hold with such nonsense.", source: "J.K. Rowling — Harry Potter and the Philosopher's Stone" },
  { id: "11111111-1111-4111-8111-000000000049", text: "It was a bright cold day in April, and the clocks were striking thirteen. Winston Smith, his chin nuzzled into his breast in an effort to escape the vile wind, slipped quickly through the glass doors of Victory Mansions, though not quickly enough to prevent a swirl of gritty dust from entering along with him.", source: "George Orwell — 1984" },
  { id: "11111111-1111-4111-8111-000000000050", text: "Marley was dead, to begin with. There is no doubt whatever about that. The register of his burial was signed by the clergyman, the clerk, the undertaker, and the chief mourner. Scrooge signed it. And Scrooge's name was good upon the change for anything he chose to put his hand to.", source: "Charles Dickens — A Christmas Carol" },
  { id: "11111111-1111-4111-8111-000000000051", text: "Beware the Jabberwock, my son. The jaws that bite, the claws that catch. Beware the Jubjub bird, and shun the frumious Bandersnatch. He took his vorpal sword in hand, long time the manxome foe he sought, so rested he by the Tumtum tree, and stood awhile in thought.", source: "Lewis Carroll — Jabberwocky" },
  { id: "11111111-1111-4111-8111-000000000052", text: "A Fox once fell into a well and could not get out again. A thirsty Goat passed by and, peeping over the edge, asked if the water was good. The Fox spoke loudly of its excellence and suggested that the Goat should descend and drink. The Goat leaped down and the Fox mounted on his horns sprang out.", source: "Aesop — Fables" },
  { id: "11111111-1111-4111-8111-000000000053", text: "To live is the rarest thing in the world. Most people exist, that is all. Be yourself; everyone else is already taken. The truth is rarely pure and never simple in the end.", source: "Oscar Wilde — Phrases and Philosophies" },
  { id: "11111111-1111-4111-8111-000000000054", text: "Do not go where the path may lead, go instead where there is no path and leave a trail. What lies behind us and what lies before us are tiny matters compared to what lies within us.", source: "Ralph Waldo Emerson — Essays" },
  { id: "11111111-1111-4111-8111-000000000055", text: "You have power over your mind, not outside events. Realize this, and you will find strength. Very little is needed to make a happy life; it is all within yourself, in your way of thinking.", source: "Marcus Aurelius — Meditations" },
  { id: "11111111-1111-4111-8111-000000000056", text: "The secret of getting ahead is getting started. The secret of getting started is breaking your complex overwhelming tasks into small manageable tasks, and then starting on the very first one with courage.", source: "Mark Twain" },
  { id: "11111111-1111-4111-8111-000000000057", text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit. Knowing yourself is the beginning of all wisdom. During our darkest moments we must focus to see the light.", source: "Aristotle — Nicomachean Ethics" },
  { id: "11111111-1111-4111-8111-000000000058", text: "Not until we are lost, in other words, not until we have lost the world, do we begin to find ourselves, and realize where we are and the infinite extent of our true relations.", source: "Henry David Thoreau — Walden" },
  { id: "11111111-1111-4111-8111-000000000059", text: "In the midst of chaos, there is also opportunity. The supreme art of war is to subdue the enemy without fighting. Let your plans be dark as night, and move like a thunderbolt across the sky.", source: "Sun Tzu — The Art of War" },
  { id: "11111111-1111-4111-8111-000000000060", text: "Hope is the thing with feathers that perches in the soul and sings the tune without the words and never stops at all, and sweetest in the Gale is heard, across every distant land.", source: "Emily Dickinson — Poems" },
  { id: "11111111-1111-4111-8111-000000000061", text: "He who has a why to live can bear almost any how. What does not kill me makes me stronger. There are no facts, only interpretations. In individuals, insanity is rare; but in groups, it is the rule.", source: "Friedrich Nietzsche — Twilight of the Idols" },
  { id: "11111111-1111-4111-8111-000000000062", text: "Beware; for I am fearless, and therefore powerful. I will watch with the wiliness of a snake, that I may sting with its venom. Man, you shall repent of the injuries you have infused upon me.", source: "Mary Shelley — Frankenstein" },
  { id: "11111111-1111-4111-8111-000000000063", text: "All the world is a stage, and all the men and women merely players; they have their exits and their entrances, and one man in his time plays many parts, his acts being seven ages.", source: "William Shakespeare — As You Like It" },
  { id: "11111111-1111-4111-8111-000000000064", text: "There are darknesses in life and there are lights, and you are one of the lights, the light of all lights. We learn from failure, not from success, and hope will always guide our weary souls.", source: "Bram Stoker — Dracula" },
  { id: "11111111-1111-4111-8111-000000000065", text: "When you have eliminated the impossible, whatever remains, however improbable, must be the truth. It has long been an axiom of mine that the little things are infinitely the most important in every investigation.", source: "Arthur Conan Doyle — The Sign of the Four" },
  { id: "11111111-1111-4111-8111-000000000066", text: "There is nothing like staying at home for real comfort. I cannot fix on the hour, or the spot, or the look, or the words, which laid the foundation. It was too long ago to remember clearly.", source: "Jane Austen — Emma" },
  { id: "11111111-1111-4111-8111-000000000067", text: "Two roads diverged in a yellow wood, and sorry I could not travel both and be one traveler, long I stood and looked down one as far as I could to where it bent in the undergrowth.", source: "Robert Frost — The Road Not Taken" },
];

export type CorpusType = "passage" | "random_words";
export type CorpusCategory = "short" | "mid" | "long";

export const COMMON_WORDS: ReadonlyArray<string> = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "it",
  "for", "not", "on", "with", "he", "as", "you", "do", "at", "this",
  "but", "his", "by", "from", "they", "we", "say", "her", "she", "or",
  "an", "will", "my", "one", "all", "would", "there", "their", "what", "so",
  "up", "out", "if", "about", "who", "get", "which", "go", "me", "when",
  "make", "can", "like", "time", "no", "just", "him", "know", "take", "people",
  "into", "year", "your", "good", "some", "could", "them", "see", "other", "than",
  "then", "now", "look", "only", "come", "its", "over", "think", "also", "back",
  "after", "use", "two", "how", "our", "work", "first", "well", "way", "even",
  "new", "want", "because", "any", "these", "give", "day", "most", "us", "great",
  "between", "need", "large", "under", "never", "place", "found", "around", "small", "number",
  "always", "right", "world", "water", "sound", "still", "learn", "point", "mother", "answer",
  "study", "change", "hand", "high", "every", "near", "school", "father", "light", "house",
  "night", "live", "page", "open", "tree", "plant", "start", "story", "city", "sea",
  "paper", "walk", "play", "run", "keep", "few", "close", "while", "along", "might",
  "next", "hard", "example", "begin", "life", "those", "both", "together", "group", "often",
  "important", "until", "children", "side", "feet", "car", "mile", "white", "began", "grow",
  "took", "river", "four", "carry", "state", "once", "book", "hear", "stop", "without",
  "second", "late", "miss", "idea", "enough", "face", "watch", "far", "really", "almost",
  "let", "above", "girl", "sometimes", "mountain", "cut", "young", "talk", "soon", "list",
  "song", "leave", "family", "body", "music", "color", "stand", "sun", "question", "fish",
  "area", "mark", "dog", "horse", "birds", "problem", "complete", "room", "knew", "since",
  "ever", "piece", "told", "usually", "friends", "easy", "heard", "order", "door", "sure",
  "become", "top", "ship", "across", "today", "during", "short", "better", "best", "however",
  "low", "hours", "black", "products", "happened", "whole", "measure", "remember", "early", "waves",
  "reached", "listen", "wind", "rock", "space", "covered", "fast", "several", "hold", "himself",
  "toward", "five", "step", "morning", "passed", "true", "hundred", "against", "pattern", "table",
  "north", "slowly", "money", "map", "farm", "draw", "voice", "seen", "cold", "plan",
  "notice", "south", "sing", "ground", "fall", "king", "town", "unit", "figure", "certain",
  "field", "travel", "wood", "fire", "upon", "done", "road", "half", "ten", "fly",
  "gave", "box", "finally", "wait", "correct", "quickly", "person", "became", "shown", "minutes",
  "strong", "stars", "front", "feel", "fact", "inches", "street", "decided", "contain", "course",
  "surface", "produce", "building", "ocean", "class", "note", "nothing", "rest", "carefully", "inside",
  "wheels", "stay", "green", "known", "island", "week", "less", "machine", "base", "ago",
  "plane", "system", "behind", "round", "boat", "possible", "force", "brought", "understand", "warm",
  "common", "bring", "explain", "dry", "though", "language", "shape", "deep", "thousands", "yes",
  "clear", "equation", "yet", "government", "filled", "heat", "full", "hot", "check", "object",
  "rule", "among", "ball", "eyes", "heavy", "material", "special", "pair", "circle", "built",
];

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateRandomWords(category: CorpusCategory = "mid"): Passage {
  const targetCount = category === "short" ? 25 : category === "long" ? 80 : 50;
  const words: string[] = [];
  let prevWord = "";
  for (let i = 0; i < targetCount; i++) {
    let word = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)]!;
    while (word === prevWord) {
      word = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)]!;
    }
    words.push(word);
    prevWord = word;
  }
  return {
    id: generateUuid(),
    text: words.join(" "),
    source: `Random Words (${category} · ${targetCount} words)`,
  };
}

export function getRandomPassage(
  category: CorpusCategory = "mid",
  excludeId?: string,
): Passage {
  const candidates = PASSAGES.filter((p) => {
    if (excludeId && p.id === excludeId && PASSAGES.length > 1) return false;
    const words = p.text.trim().split(/\s+/).length;
    if (category === "short") return words <= 42;
    if (category === "mid") return words >= 43 && words <= 49;
    return words >= 50;
  });

  const pool = candidates.length > 0 ? candidates : PASSAGES;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index]!;
}

export function getRandomCorpus(
  type: CorpusType = "passage",
  category: CorpusCategory = "mid",
  excludeId?: string,
): Passage {
  if (type === "random_words") {
    return generateRandomWords(category);
  }
  return getRandomPassage(category, excludeId);
}

export function isValidPassageId(id: string): boolean {
  return PASSAGES.some((p) => p.id === id);
}

export function getPassageById(id: string): Passage | null {
  return PASSAGES.find((p) => p.id === id) ?? null;
}

export function hostPickedPreview(passage: Passage): string {
  if (passage.text.length <= 30) return passage.text;
  return passage.text.slice(0, 30) + "…";
}

export type PassageLengthFilter = "all" | "short" | "medium" | "long";

export interface PassageFilterCriteria {
  length?: PassageLengthFilter;
  punctuation?: boolean | null;
}

export function filterPassages(
  passages: readonly Passage[] = PASSAGES,
  criteria: PassageFilterCriteria = {},
): Passage[] {
  return passages.filter((p) => {
    if (criteria.length && criteria.length !== "all") {
      const words = p.text.trim().split(/\s+/).length;
      if (criteria.length === "short" && words > 45) return false;
      if (criteria.length === "medium" && (words < 42 || words > 50)) return false;
      if (criteria.length === "long" && words <= 50) return false;
    }
    if (criteria.punctuation !== undefined && criteria.punctuation !== null) {
      const hasComplexPunctuation = /[.,'"!?;:-]/.test(p.text);
      if (criteria.punctuation && !hasComplexPunctuation) return false;
      if (!criteria.punctuation && hasComplexPunctuation) return false;
    }
    return true;
  });
}
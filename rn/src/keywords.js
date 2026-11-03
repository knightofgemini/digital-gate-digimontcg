// Spiegazione delle keyword (＜Raid＞, ＜Security A. +1＞...): regola in inglese adattata ai valori della carta.
// Copiata così com'è da src/template.html (kwN, kwArg, kwInfo): i testi restano identici.
/* eslint-disable */
function kwN(n, s, p) { n = Math.abs(+n); return n + " " + (n === 1 ? s : p); }
function kwArg(inner, name) { var a = inner.slice(name.length).trim(); return a.replace(/\)\/\(/g, "/").replace(/^\((.*)\)$/, "$1").trim(); }
function kwInfo(inner) {
  var k = String(inner).replace(/ /g, " ").trim(), m, a;
  function cards(n) { return kwN(n, "card", "cards"); }
  if ((m = k.match(/^Security A\.\s*([+-])\s*(\d+)\}?$/))) {
    var n = +m[2];
    return m[1] === "+" ? "When this Digimon attacks your opponent, it checks " + cards(n) + " more from their security stack: " + (n + 1) + " in total instead of the usual 1 (other effects can still change this number)."
      : "When this Digimon attacks your opponent, it checks " + cards(n) + " fewer from their security stack than the usual 1. If the number of checks becomes 0 or less, it doesn't check any security cards.";
  }
  if (/^Security A\.\s*[+-]?$/.test(k)) return "Security Attack changes how many security cards a Digimon checks when it attacks your opponent. Normally a Digimon checks 1 card: ＜Security A. +＞ adds checks, ＜Security A. -＞ removes them.";
  if ((m = k.match(/^Draw (\d+)$/))) return "Draw " + cards(m[1]) + " from the top of your deck and add " + (+m[1] === 1 ? "it" : "them") + " to your hand.";
  if ((m = k.match(/^De-Digivolve (\d+)$/))) return "Choose 1 of your opponent's Digimon and trash the top card of its stack" + (+m[1] === 1 ? "" : ", up to " + m[1] + " times") + ": the card below becomes the Digimon. You can't trash past level 3 cards: if the top card is level 3, or the Digimon has no digivolution cards left, you can't trash any more cards.";
  if (k === "De-Digivolve") return "Trash the top card of an opponent's Digimon, up to the number of times shown: the card below becomes the Digimon. You can't trash past level 3 cards: if the top card is level 3, or the Digimon has no digivolution cards left, you can't trash any more cards.";
  if ((m = k.match(/^Recovery \+(\d+)(\s*\(Deck\))?$/))) return "Take the top " + (+m[1] === 1 ? "card" : m[1] + " cards") + " of your deck and place " + (+m[1] === 1 ? "it" : "them") + " face down on top of your security stack, increasing it by " + m[1] + ".";
  if ((m = k.match(/^Digi-Burst (up to )?(\d+)$/))) return "You may trash " + (m[1] ? "up to " : "") + cards(m[2]) + " from under this Digimon (its digivolution cards) to activate the effect written below. If it doesn't have enough digivolution cards, you can't activate it.";
  if (k === "Digi-Burst") return "You may trash the number of cards shown from under this Digimon (its digivolution cards) to activate the effect written below. If it doesn't have enough digivolution cards, you can't activate it.";
  if ((m = k.match(/^Material Save (\d+)$/))) return "When this Digimon would be deleted, you may take " + cards(m[1]) + " from its digivolution cards that match its DigiXros requirements and place " + (+m[1] === 1 ? "it" : "them") + " under 1 of your Tamers, so you can use " + (+m[1] === 1 ? "it" : "them") + " again later (for example for another DigiXros). This isn't the same as ＜Save＞.";
  if ((m = k.match(/^Fragment \((\d+)\)$/))) return "When this Digimon would be deleted, you may trash any " + m[1] + " of its digivolution cards (the cards under it). If you do, it isn't deleted and stays in play.";
  if ((m = k.match(/^Link \+(\d+)$/))) return "Link cards are plugged in sideways under a Digimon. Normally a Digimon can have only 1 link card: ＜Link +" + m[1] + "＞ adds " + m[1] + " to that limit, so this Digimon can have up to " + (1 + +m[1]) + " link cards.";
  if ((m = k.match(/^Digisorption -(\d+)$/))) return "When one of your Digimon would digivolve into this card from your hand, you may suspend 1 of your Digimon (it can be the one digivolving) to reduce the memory cost of that digivolution by " + m[1] + ".";
  if (k === "Digisorption") return "When one of your Digimon would digivolve into this card from your hand, you may suspend 1 of your Digimon to reduce the memory cost of that digivolution by the amount shown.";
  if ((m = k.match(/^DigiXros\s*-(\d+)$/))) return "When you play this card, you may first place cards that meet its DigiXros requirements (listed after it) from your hand and/or battle area under it as its digivolution cards. Each card placed reduces the play cost by " + m[1] + ". You can place any number of the listed cards (each one once, unless a number is given), but at least 1 if you declare it; the first card listed goes on top. Cards taken from the battle area leave the field. The cost can't go below 0.";
  if ((m = k.match(/^Assembly\s*-(\d+)$/))) return "When you play this card, you may first place the cards listed in its Assembly requirements from your trash under it as its digivolution cards. If you do, the play cost is reduced by " + m[1] + " in total (not per card). You must place all the listed cards, otherwise you can't use it; the first card listed goes on top. It also works when an effect plays this card. The cost can't go below 0.";
  if ((m = k.match(/^(?:Overflow\s*)?-(\d+)$/))) return "Digimon ACE rule: when this card leaves the battle area, or moves from under another card to any other area, you lose " + m[1] + " memory (the memory counter moves " + m[1] + " toward your opponent's side). Nothing happens when it enters the battle area or is placed under a card.";
  if (/^Decode\b/.test(k)) {
    a = kwArg(k, "Decode");
    var what = !a ? "specified Digimon card" : /^(\[[^\]]+\])(\/\[[^\]]+\])*$/.test(a) ? a.split("/").join(" or ") : "Digimon card (" + a + ")";
    return "When this Digimon would leave the battle area other than in battle (for example deleted, returned to the hand or deck by an effect), you may play 1 " + what + " from its digivolution cards without paying the cost. It doesn't work when the Digimon is deleted in a battle.";
  }
  if (/^Decoy\b/.test(k)) { a = kwArg(k, "Decoy"); return "When 1 or more of your other " + a.split("/").join(" or ") + " Digimon would be deleted by an opponent's effect, you may delete this Digimon instead to save 1 of them. It protects only from effects, not from battles."; }
  if (/^Partition\b/.test(k)) { a = kwArg(k, "Partition"); return "If this Digimon has each of the specified cards (" + a + ") among its digivolution cards and would leave the battle area other than by your own effects or by battle, you may play 1 of each specified card from its digivolution cards without paying the costs. It splits back into the two Digimon it was made from."; }
  if (/^Overclock\b/.test(k)) { a = kwArg(k, "Overclock").replace(/\s*Trait$/i, ""); return "At the end of your turn, you may delete 1 of your Tokens or 1 of your other " + (a ? a + " trait" : "specified") + " Digimon. If you do, this Digimon attacks your opponent (the player) without suspending."; }
  if (/^Use Req\./.test(k)) { a = kwArg(k, "Use Req."); return "Normally you can use an Option card only if you have a Digimon or Tamer of its color in play. With this, the specified cards (" + a + ") let you ignore that color requirement and use this card."; }
  if (/^Detach\b/.test(k)) { a = kwArg(k, "Detach"); return "When this Digimon would leave the battle area other than by your effects, you may trash 1 of its link cards" + (a ? " with the " + a.replace(/\s*trait$/, "") + " trait" : " of the specified kind") + ". If you do, it stays in play."; }
  if (/^Succession\b/.test(k)) { a = kwArg(k, "Succession"); return "This Digimon gains all the effects (except ＜Succession＞) of the topmost specified card" + (a ? " (" + a + ")" : "") + " among its digivolution cards, as if they were written on it."; }
  if (/^Blast DNA Digivolve\b/.test(k)) { a = kwArg(k, "Blast DNA Digivolve"); return "Used from your hand when your opponent's Digimon attacks ([Counter] timing, before blocking): 1 of your specified Digimon and 1 specified card in your hand" + (a ? " (" + a + ")" : "") + " may DNA digivolve into this card, so it can fight the attacker."; }
  var FIX = {
    "Blocker": "When your opponent's Digimon attacks, after the attack is declared you may suspend this unsuspended Digimon to block. The attack is redirected to this Digimon, and they battle. Only 1 Digimon can block each attack, and the Digimon being attacked can't block.",
    "Piercing": "When this Digimon attacks one of your opponent's Digimon, deletes it in battle and isn't deleted itself, it then checks your opponent's security as if it had attacked the player, with its usual number of checks.",
    "Reboot": "This Digimon also unsuspends during your opponent's unsuspend phase (at the start of their turn). So it can attack in your turn and still be ready to block or use effects in your opponent's turn.",
    "Save": "You may place this card under 1 of your Tamers (usually when this Digimon is deleted). Cards under your Tamers can be used later by other effects, for example DigiXros or effects that refer to cards with ＜Save＞.",
    "Delay": "This card must be in your battle area. From the turn after it was placed there, you may trash it to activate the effect written below (after ・). You can't do it in the same turn it was placed.",
    "Jamming": "This Digimon can't be deleted in battles against Security Digimon (Digimon revealed from your opponent's security stack during a security check). Even if it loses that battle, it stays in play.",
    "Rush": "Normally a Digimon can't attack in the turn it is played. This Digimon can attack in the same turn it comes into play.",
    "Retaliation": "When this Digimon is deleted because it lost a battle, the Digimon it was battling is also deleted. It works both when it attacks and when it's attacked or blocks.",
    "Alliance": "When this Digimon attacks, you may suspend 1 of your other Digimon. If you do, for that attack this Digimon adds the suspended Digimon's DP to its own and gains ＜Security A. +1＞.",
    "Raid": "When this Digimon attacks, you may switch the target of the attack to 1 of your opponent's unsuspended Digimon with the highest DP.",
    "Barrier": "When this Digimon would be deleted in a battle, you may trash the top card of your security stack. If you do, it isn't deleted. It protects only in battles, not from effects.",
    "Blast Digivolve": "Used from your hand when your opponent's Digimon attacks ([Counter] timing, before blocking): 1 of your Digimon that meets this card's digivolution requirements may digivolve into this card without paying the cost, so it can fight the attacker.",
    "Armor Purge": "When this Digimon would be deleted, you may trash its top card instead. The card below becomes the Digimon, which isn't deleted and stays in play.",
    "Collision": "During this Digimon's attack, all of your opponent's Digimon gain ＜Blocker＞, and your opponent must block with one of them if possible.",
    "Fortitude": "When this Digimon is deleted while it has digivolution cards, play this card again without paying the cost (as a new Digimon, without digivolution cards).",
    "Evade": "When this Digimon would be deleted, you may suspend it instead (it must be unsuspended). If you do, it isn't deleted.",
    "Blitz": "If your opponent has 1 or more memory, this Digimon may attack right away. Usually it comes with [When Digivolving]: even if the digivolution cost moved the memory to your opponent's side, it can still attack before your turn ends. It can't start a new attack during another attack.",
    "Training": "During your main phase, you may suspend this Digimon to place the top card of your deck face down under it as its bottom digivolution card. It also works in the breeding area.",
    "Arts Digivolve": "This is the Option side of a DUAL card. After you use it as an Option, instead of trashing it, 1 of your cards in play may digivolve into this card (as a Digimon) without paying the cost.",
    "Vortex": "At the end of your turn, this Digimon may attack 1 of your opponent's Digimon. With this effect it can attack even in the turn it was played.",
    "Scapegoat": "When this Digimon would be deleted other than by your own effects, you may delete 1 of your other Digimon instead. If you do, this Digimon isn't deleted.",
    "Execute": "At the end of your turn, this Digimon may attack, and it can also attack your opponent's unsuspended Digimon. At the end of that attack, this Digimon is deleted.",
    "Iceclad": "In this Digimon's battles (except against Security Digimon), compare the number of digivolution cards instead of DP: the Digimon with fewer is deleted, and if they're equal both are deleted.",
    "Progress": "While this Digimon is attacking, your opponent's effects don't affect it (for example they can't delete it, reduce its DP or return it to the hand).",
    "Mind Link": "Place this Tamer under the chosen Digimon as its bottom digivolution card, so the Tamer's inherited effect works for that Digimon. You can't do it if that Digimon already has a Tamer card among its digivolution cards.",
    "Guard": "When 1 or more of your other Digimon would leave the battle area because of your opponent's effects, you may delete this Digimon instead. If you do, they don't leave.",
    "Ascension": "When this Digimon is deleted, you may place this card on top of your security stack, so it becomes your top security card.",
    "Link": "During your main phase you can link this card, from your hand or battle area, to 1 of your Digimon that meets its link requirements by paying its link cost: it's plugged in sideways under that Digimon (it isn't a digivolution card). While linked, that Digimon adds this card's link DP to its own and gains the effect written after [Link]. Normally a Digimon can have only 1 link card: linking a new one trashes the old one (＜Link +N＞ raises the limit). Linking isn't playing the card.",
    "Engage": "At the end of your turn, this Digimon may attack. It's an extra chance to attack before your turn ends.",
    "Decode": "When this Digimon would leave the battle area other than in battle, you may play 1 of the specified Digimon cards from its digivolution cards without paying the cost. It doesn't work when the Digimon is deleted in a battle.",
    "Overclock": "At the end of your turn, you may delete 1 of your Tokens or 1 of your other Digimon of the specified trait. If you do, this Digimon attacks your opponent (the player) without suspending."
  };
  return FIX[k] || FIX[k.replace(/\s*\(.*$/, "")] || null;
}
export { kwInfo };

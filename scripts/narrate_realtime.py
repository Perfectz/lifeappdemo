#!/usr/bin/env python3
"""
Generate the LifeQuest explainer narration with the OpenAI Realtime Voice 2 API
(model gpt-realtime-2, voice "marin") — matching the in-app voice agent.

Requires OPENAI_API_KEY in the environment or in .env.local.
Usage:  python3 scripts/narrate_realtime.py
Outputs:  narration/marin/01.wav ... 17.wav  (24kHz mono PCM)

Then rebuild the audio + remux (see remux command printed at the end).
"""
import os, json, base64, wave, struct, sys, pathlib

LINES = [
 "In a world where you forget to drink water and call it being busy, one app dares to turn your sad little Tuesday into an epic quest.",
 "Behold: the Second Brain. A wiki you write about yourself, because your first brain has, frankly, been slacking.",
 "Every morning it crams your entire personality into the AI's context window. A digital burrito of feelings and blood pressure.",
 "The Morning Stand-Up. Log your vitals, declare your main quest, and lie to yourself about waking up at five a.m.",
 "Track real vitals: glucose, blood pressure, weight. And watch the line go down, like your will to meal-prep.",
 "Scan a barcode and, bam, calories revealed. The protein bar can no longer hide its dark, twenty-four-carb secret.",
 "Your food diary, fully loaded. Macros tracked, snacks judged, dignity entirely optional.",
 "Three workouts. Every. Single. Day. Strength, cardio, and martial arts, because one form of suffering is for amateurs.",
 "Your to-do list is now a Quest Log: legally distinct from chores, and one hundred percent more heroic.",
 "Progress photos: front, side, and face. Stored on your device, so only you and your inevitable AI judge can see them.",
 "Capture lessons in the journal, save thoughts in notes, or just whisper your regrets and let the app write them down.",
 "Snap a photo and the AI logs it instantly, and it asks permission first. Unlike your relatives at dinner.",
 "Meet your AI coach. It read your entire file, and it will be honest. Encouraging? Sure. Flattering? Absolutely not.",
 "Or go hands-free. Bark orders like a tiny tyrant, and it logs workouts and clears quests without a single complaint.",
 "Everything earns XP. Energy is your HP, mood is your MP, and your streak is the only thing between you and total chaos.",
 "Behold the boss battle. Defeat Bad Sleep, whose health bar drains as you, shockingly, sleep. Level, up.",
 "LifeQuest OS. Your second brain, your save file, and your slightly judgmental life coach. Now go touch grass, and gain XP.",
]

MODEL = os.environ.get("OPENAI_REALTIME_MODEL", "gpt-realtime-2")
VOICE = "marin"

def load_key():
    k = os.environ.get("OPENAI_API_KEY", "").strip()
    if k: return k
    envf = pathlib.Path(__file__).resolve().parent.parent / ".env.local"
    if envf.exists():
        for line in envf.read_text().splitlines():
            if line.startswith("OPENAI_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""

def synth_realtime(text, key):
    """Open a Realtime websocket, request an audio-only response reading `text`
    verbatim, and collect pcm16 (24kHz mono) deltas."""
    from websocket import create_connection  # pip install websocket-client
    url = f"wss://api.openai.com/v1/realtime?model={MODEL}"
    ws = create_connection(url, header=[
        f"Authorization: Bearer {key}",
        "OpenAI-Beta: realtime=v1",
    ], timeout=60)
    ws.send(json.dumps({"type":"session.update","session":{
        "modalities":["audio","text"],
        "voice":VOICE,
        "output_audio_format":"pcm16",
        "instructions":"You are a movie-trailer narrator. Read the user's text VERBATIM, "
                       "with dramatic, slightly comedic delivery. Do not add or change words."
    }}))
    ws.send(json.dumps({"type":"conversation.item.create","item":{
        "type":"message","role":"user",
        "content":[{"type":"input_text","text":text}]}}))
    ws.send(json.dumps({"type":"response.create","response":{"modalities":["audio"]}}))
    pcm = bytearray()
    while True:
        ev = json.loads(ws.recv())
        t = ev.get("type","")
        if t in ("response.audio.delta","response.output_audio.delta"):
            pcm += base64.b64decode(ev["delta"])
        elif t in ("response.done","response.audio.done","response.output_audio.done","error"):
            if t == "error": print("  ! error:", ev.get("error")); 
            if t == "response.done": break
    ws.close()
    return bytes(pcm)

def write_wav(path, pcm, rate=24000):
    with wave.open(path,"w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)

def main():
    key = load_key()
    if not key:
        print("No OPENAI_API_KEY found (env or .env.local). Add it and re-run."); sys.exit(1)
    out = pathlib.Path(__file__).resolve().parent.parent / "narration" / "marin"
    out.mkdir(parents=True, exist_ok=True)
    for i, line in enumerate(LINES, 1):
        print(f"[{i:02d}/17] {line[:48]}...")
        pcm = synth_realtime(line, key)
        write_wav(str(out / f"{i:02d}.wav"), pcm)
    print("Done ->", out)
    print("\nNext: regenerate audio + remux. From the project, with the sandbox helpers:")
    print("  (point the audio-mix step at narration/marin/*.wav instead of vo3/*.wav, then)")
    print("  ffmpeg -i video3.mp4 -i audio_marin.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k lifequest-mobile-parody-marin.mp4")

if __name__ == "__main__":
    main()

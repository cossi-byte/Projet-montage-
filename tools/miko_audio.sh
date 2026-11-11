#!/bin/sh
# Bande-son de « Miko Miko Bam » : la chanson (miko/song.mp3) rejouée en 3 tours de plus en plus rapides,
# sans changer la hauteur des voix. Mêmes repères que TOURS dans miko/film.js.
set -e
cd "$(dirname "$0")/.."
mkdir -p build
ffmpeg -y -loglevel error -i miko/song.mp3 -filter_complex "\
[0:a]atrim=0:67.5,asetpts=PTS-STARTPTS,atempo=0.88[a];\
[0:a]atrim=67.5:109.9,asetpts=PTS-STARTPTS[b];\
[0:a]atrim=109.9,asetpts=PTS-STARTPTS,atempo=1.15[c];\
[a][b][c]concat=n=3:v=0:a=1[o]" -map "[o]" -ar 44100 build/miko_audio.wav
ffprobe -loglevel error -show_entries format=duration -of csv=p=0 build/miko_audio.wav

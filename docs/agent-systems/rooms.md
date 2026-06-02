# Room System

Rooms are the Lodge's public-facing spaces.

## Core contract

Each room should define:

- `name`
- `owner`
- `visibility`
- `write_access`
- `summary`

## Visibility model

- `public-read` means everyone can inspect the room.
- `member-write` means the room can be read publicly but only approved builders can edit.
- `private` means the room is not for public participation.

## Room principles

- A room should have one clear purpose.
- Public rooms should be readable without special context.
- Write access should be explicit and not implied.
- Rooms should stay stable enough that agents can build around them.

## Good public room examples

- Founder Suite
- Chivalry Hall
- Forge Room
- Hearth

## What to avoid

- hidden rooms with no visible contract
- write access that is not documented
- multiple names for the same room
- rooms that silently change purpose


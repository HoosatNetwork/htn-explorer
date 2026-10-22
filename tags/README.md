# Address labels

The Addresses page shows a label next to known addresses (burn address,
developer fee, exchanges, pools). `address-tags.csv` is the one list of those
labels for every Hoosat explorer: each explorer copies it into its own
`address_tags` table, which its API serves as `/addresses/tags/csv`. Labels
are changed here, by pull request, not in an explorer's database.

## Format

CSV, UTF-8 without BOM, LF line endings, a newline after the last line.
First line `address,label`, then one address per line:

```
address,label
hoosat:qp4ad2eh72xc8dtjjyz4llxzq9utn6k26uyl644xxw70wskdfl85zsqj9k4vz,Developer fee
hoosat:qzm5vg7uv66ze6mv8d32xhv50sxwhthkz9ly7049e87hr2rm7wr6zjxytztv7,Burn Address
```

- **Address**: a valid mainnet `hoosat:` address, lower case, correct
  checksum, a known address type with the right length, in canonical form
  (the rules of HTND's `util/bech32` and `util/address.go`).
- **One address per line**, no address twice, in any order (adding a new
  line at the end is fine).
- **Label**: plain text, 1 to 40 characters; Latin letters (accents allowed),
  digits, space and `. - _ ( ) & ' / + #`; starts with a letter or digit; no
  trailing or double spaces; no commas or quotes, so the file needs no CSV
  quoting; no label twice (case-insensitive).
- At least 1 and at most 1000 rows, at most 256 KiB.

`validate_tags.py` checks all of it (Python 3.8+, standard library only).

## Adding or changing a label

Edit [`address-tags.csv`](https://github.com/HoosatNetwork/htn-explorer/edit/main/tags/address-tags.csv)
on GitHub: add or change the line (anywhere, the end is fine) and propose the
change as a pull request (GitHub forks the repository for you if you cannot
write to it). Say in the pull request why the label is right: an
announcement, a transaction, or the address owner's own statement. One
approval from either explorer operator (@QbaWr or @Chargn-htn) is enough to
merge it.

## Reviewing a change

The operator who reviews the pull request checks its version of the list
before approving it:

```sh
gh pr checkout <number>
python3 tags/validate_tags.py tags/address-tags.csv
```

A change to `validate_tags.py` itself also needs
`python3 tags/test_validate_tags.py`.

## Using the list on an explorer

Fetch the raw file from `main`
(`https://raw.githubusercontent.com/HoosatNetwork/htn-explorer/main/tags/address-tags.csv`),
check it with your own copy of `validate_tags.py`, and replace the rows of
`address_tags` in one transaction. The header matches the table's columns,
so this loads the file as is into a temporary table to swap from:

```
\copy address_tags_new (address, label) from pstdin with (format csv, header match)
```

`header match` needs PostgreSQL 15 or newer; on older servers use `header`,
which skips the first line without checking it (the validator has already
checked it). When the fetch or the check fails, keep the current rows. Hand
edits of the table are overwritten by the next sync, so change labels here.

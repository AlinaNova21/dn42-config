#!/bin/sh
peers() {
  action="$1"
  . "$(dirname $(readlink -f "$0"))/peers.sh"
}

. "$(dirname $(readlink -f "$0"))/functions.sh"#
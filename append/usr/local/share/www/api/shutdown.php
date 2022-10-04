<?php
/**
 *    DSAS - Tinycore
 *    Copyright (C) 2021-2022  Electricite de France
 *
 *    This program is free software; you can redistribute it and/or modify
 *    it under the terms of the GNU General Public License as published by
 *    the Free Software Foundation; either version 2 of the License, or
 *    (at your option) any later version.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU General Public License for more details.
 *
 *    You should have received a copy of the GNU General Public License along
 *    with this program; if not, write to the Free Software Foundation, Inc.,
 *    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

require_once "common.php";

if (! dsas_loggedin())
  header("HTTP/1.0 403 Forbidden");
else {
  // Must use exec here as dsas_exec returns an unwanted error while web server is shutting down
  exec("sudo sudo -u haut ssh tc@" . interco_haut() . " /usr/bin/sudo /sbin/poweroff", $output, $retval);
  // The above will give an error is the machine haut is down. So don't test for an error
  // here before taking the machine bas down
  exec("/usr/bin/sudo /sbin/poweroff", $output, $retval);
  if ($retval != 0)
    header("HTTP/1.0 500 Internal Server Error");
  else
    echo "Ok";
}

?>

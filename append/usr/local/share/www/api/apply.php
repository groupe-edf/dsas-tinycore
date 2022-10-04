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
  // exec here for now, use proc_open to avoid shell if user input is supplied
  $haut = interco_haut();

  // FIXME Can't use dsas_exec here as this command sent a HUP to the very server
  // on which this PHP code is running. So dsas_exec will hang in this case. 
  // exceptionally we use "exec" that seems to work.
  exec("sudo /etc/init.d/services/dsas apply", $dummy, $retval);
  $output["retval"] = $retval;

  if ($output["retval"] == 0) 
    $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . $haut, "cp", "/var/dsas/dsas_conf.xml", "/var/dsas/dsas_conf.xml.old"]);
  if ($output["retval"] == 0) {
    copy("/var/dsas/dsas_conf.xml", "/tmp/dsas_conf.xml");
    chmod("/tmp/dsas_conf.xml", 644);
    $output = dsas_exec(["sudo", "sudo", "-u", "haut", "scp", "/tmp/dsas_conf.xml", "tc@" . $haut . ":/tmp"]);
    unlink("/tmp/dsas_conf.xml");
  }
  if ($output["retval"] == 0) 
    $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . $haut, "mv", "/tmp/dsas_conf.xml", "/var/dsas/dsas_conf.xml"]);
  if ($output["retval"] == 0)
    $output = dsas_exec(["sudo", "sudo", "-u", "haut", "ssh", "tc@" . $haut, "sudo", "/etc/init.d/services/dsas", "apply"]);
  if ($output["retval"] != 0)
    header("HTTP/1.0 500 Internal Server Error: " . explode("/n", $output["stderr"])[0]);
  else
    echo "Ok";
}
?>

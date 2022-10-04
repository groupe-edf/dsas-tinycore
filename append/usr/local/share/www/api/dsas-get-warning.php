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
  $dsas = simplexml_load_file(_DSAS_XML);
  $warn = array();

  if ($dsas === false)
    $warn = ["type" => "warn", "msg" => "Error loading XML file"];
  else {
    if (force_passwd()) $warn[] =
       ["type" => "error", "msg" => "First use. All of the passwords must be changed."];
    if ($dsas->tasks->task->count() == 0) $warn[] = 
       ["type" => "warn", "msg" => "No tasks are configured."];
  }
  header("Content-Type: application/json");
  echo json_encode($warn);
}

?>

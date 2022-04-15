<?php
require_once "common.php";

if (! dsas_loggedin(false))
  die(header("HTTP/1.0 403 Forbidden"));
else {
  $output = dsas_exec(["free", "-b"]);
  $free = $output["stdout"];
  $free = (string)trim($free);
  $free_arr = explode("\n", $free);
  $mem = explode(" ", $free_arr[1]);
  $mem = array_filter($mem);
  $mem = array_merge($mem);
  $output = dsas_exec(["cat", "/proc/cpuinfo"]);
  $cpuinfo = $output["stdout"];
  preg_match("/^cpu cores.*:(.*)$/m", $cpuinfo, $matches);
  $cores = trim($matches[1]);
  $output = dsas_exec(["cat", "/proc/loadavg"]);
  $loadavg = explode(" ", $output["stdout"])[0];
  $d = _DSAS_HOME;
  $bas = ["disk" =>  $d,
          "disk_free" => disk_free_space($d),
          "disk_total" => disk_total_space($d),
           // With a ramdisk, the free memory is pretty much false. Used 'Total - Avail' instead
          "memory_used" => (int)$mem[1] - (int)$mem[6],
          "memory_total" => (int)$mem[1],
          "cores" => (int)$cores,
          "loadavg" => (float)$loadavg];

  # test if the machine haut is alive before proceeding
  $hautip = interco_haut();
  $output = dsas_exec(["ping", "-q", "-c", "1", "-W", "1", $hautip]);
  if ($output["retval"] == 0) {
    $output = dsas_exec(["ssh", "tc@" . $hautip, "free", "-b"]);
    $free = $output["stdout"];
    $free = (string)trim($free);
    $free_arr = explode("\n", $free);
    $mem = explode(" ", $free_arr[1]);
    $mem = array_filter($mem);
    $mem = array_merge($mem);
    $output = dsas_exec(["ssh", "tc@" . $hautip, "cat", "/proc/loadavg", "/proc/cpuinfo"]);
    $loadavg = explode(" ", $output["stdout"])[0];
    $cpuinfo = $output["stdout"];
    preg_match("/^cpu cores.*:(.*)$/m", $cpuinfo, $matches);
    $cores = trim($matches[1]);
    $output = dsas_exec(["ssh", "tc@" . $hautip, "stat", "-f", "-c", "'%S %a %b'", $d]);
    $output_arr = explode(" ", (string)trim($output["stdout"]));
    $blksz = (int)$output_arr[0];
    $free = (int)$output_arr[1] * $blksz;
    $total = (int)$output_arr[2] * $blksz;
    $haut = ["status" => "up",
             "disk" =>  $d,
             "disk_free" => $free,
             "disk_total" => $total,
             "memory_used" => (int)$mem[1] - (int)$mem[6],
             "memory_total" => (int)$mem[1],
             "cores" => (int)$cores,
             "loadavg" => (float)$loadavg];
  } else
    $haut = ["status" => "down",
             "disk" =>  $d,
             "disk_free" => 1,
             "disk_total" => 1,
             "memory_used" => 0,
             "memory_total" => 1,
             "cores" => 1,
             "loadavg" => (float)0.0];

  header("Content-Type: application/json");
  echo json_encode(["haut" => $haut, "bas" => $bas]);
}

?>

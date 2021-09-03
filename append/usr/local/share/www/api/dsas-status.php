<?php
require_once "common.php";

if (! dsas_loggedin())
  die(header("HTTP/1.0 403 Forbidden"));
else {
  $free = shell_exec('free -b');
  $free = (string)trim($free);
  $free_arr = explode("\n", $free);
  $mem = explode(" ", $free_arr[1]);
  $mem = array_filter($mem);
  $mem = array_merge($mem);
  $cpuinfo = shell_exec('cat /proc/cpuinfo');
  preg_match("/^cpu cores.*:(.*)$/m", $cpuinfo, $matches);
  $cores = trim($matches[1]);
  $loadavg = explode(" ", shell_exec('cat /proc/loadavg'))[0];
  $d = dsas_dir();
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
  exec('ping -q -c 1 -W 1 ' . $hautip, $output, $status);
  if ($status == 0) {
    $free = shell_exec('ssh tc@' . $hautip . ' free -b');
    $free = (string)trim($free);
    $free_arr = explode("\n", $free);
    $mem = explode(" ", $free_arr[1]);
    $mem = array_filter($mem);
    $mem = array_merge($mem);
    $cpuinfo = shell_exec('ssh tc@' . $hautip . ' cat /proc/cpuinfo');
    preg_match("/^cpu cores.*:(.*)$/m", $cpuinfo, $matches);
    $cores = trim($matches[1]);
    $loadavg = explode(" ", shell_exec('ssh tc@' . $hautip . ' cat /proc/loadavg'))[0];
    $blksz = (int)shell_exec('ssh tc@' . $hautip . ' stat -f -c %S ' . $d);
    $free = (int)shell_exec('ssh tc@' . $hautip . ' stat -f -c %a ' . $d) * $blksz;
    $total = (int)shell_exec('ssh tc@' . $hautip . ' stat -f -c %b ' . $d) * $blksz;

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